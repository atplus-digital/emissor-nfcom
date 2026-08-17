/**
 * Outbox relay worker (ADR-0002/0003).
 *
 * Drena a tabela `outbox` do SQLite e entrega as mudanças de estado ao Atacado
 * via `AtacadoPort`. Entrega **ao-menos-uma-vez**: em falha, incrementa
 * tentativas e repropaga (BullMQ retenta o batch). A idempotência **reside no
 * Atacado** (update por id é idempotente) — o relay não dedup; ele garante
 * entrega, e o Atacado suporta replay (ADR-0003).
 *
 * Payload codifica qual método da porta chamar + args. O dispatcher traduz
 * payload → chamada de porta. Manter o payload alinhado aos métodos de
 * `AtacadoPort` (atualizarStatus* / registrarErro).
 */
import type { CoordDB } from "#/lib/db/client";
import type { AtacadoPort } from "#/domain/ports/atacado.port";
import {
	drainOutbox,
	markOutboxDone,
	incOutboxAttempts,
	type OutboxRow,
} from "#/lib/db/outbox";
import { log, runWithLogContext } from "#/lib/logger";
import { QUEUE_NAMES, JOB_NAMES } from "#/lib/queue-names";

/** DB de coordenação — alinhado ao tipo aceito pelos helpers de outbox. */

/** Payload do outbox: qual método da AtacadoPort chamar + args nomeados. */
export type OutboxPayload =
	| { method: "atualizarStatusFatura"; args: { id: number; status: string } }
	| {
			method: "atualizarStatusCobranca";
			args: { id: number; status: string; extra?: Record<string, unknown> };
	  }
	| { method: "atualizarStatusNota"; args: { id: number; input: Record<string, unknown> } }
	| { method: "registrarErro"; args: { input: Record<string, unknown> } };

/**
 * Despacha um payload outbox para o método correspondente de `AtacadoPort`.
 * Puro (sem I/O de SQLite) — testável isoladamente com um AtacadoPort fake.
 * Lança se o método for desconhecido (payload corrompido).
 */
export async function despacharOutbox(
	atacado: AtacadoPort,
	payload: OutboxPayload,
): Promise<void> {
	switch (payload.method) {
		case "atualizarStatusFatura":
			await atacado.atualizarStatusFatura(
				payload.args.id,
				payload.args.status as Parameters<AtacadoPort["atualizarStatusFatura"]>[1],
			);
			return;
		case "atualizarStatusCobranca":
			await atacado.atualizarStatusCobranca(
				payload.args.id,
				payload.args.status as Parameters<AtacadoPort["atualizarStatusCobranca"]>[1],
				payload.args.extra as Parameters<AtacadoPort["atualizarStatusCobranca"]>[2],
			);
			return;
		case "atualizarStatusNota":
			await atacado.atualizarStatusNota(
				payload.args.id,
				payload.args.input as Parameters<AtacadoPort["atualizarStatusNota"]>[1],
			);
			return;
		case "registrarErro":
			await atacado.registrarErro(
				payload.args.input as unknown as Parameters<AtacadoPort["registrarErro"]>[0],
			);
			return;
		default: {
			const _exhaustive: never = payload;
			const msg = `despacharOutbox: método desconhecido: ${
				(payload as { method: string }).method
			}`;
			throw new Error(msg);
		}
	}
}

/**
 * Entrega **uma** linha do outbox. Em sucesso marca `done`; em falha incrementa
 * tentativas e repropaga (o caller / BullMQ decide o retry). At-least-once:
 * o Atacado suporta replay (update por id é idempotente).
 */
export async function entregarLinha(
	db: CoordDB,
	atacado: AtacadoPort,
	row: OutboxRow,
): Promise<void> {
	const payload = row.payload as OutboxPayload;
	try {
		await despacharOutbox(atacado, payload);
		await markOutboxDone(db, row.id);
		log.debug({ outboxId: row.id, method: payload.method }, "outbox entregue");
	} catch (err) {
		await incOutboxAttempts(db, row.id);
		log.warn(
			{ err, outboxId: row.id, method: payload.method, aggregate: row.aggregate },
			"outbox: entrega falhou (relay retenta)",
		);
		throw err;
	}
}

/**
 * Drena até `limit` linhas pendentes e entrega cada uma. Retorna quantas foram
 * entregues com sucesso. Em falha numa linha, para de processar o batch e
 * repropaga (mantém as restantes pending) — BullMQ retenta o batch inteiro.
 * Entrega na ordem por id (mais antiga primeiro, via drainOutbox).
 */
export async function drenarEEntregar(
	db: CoordDB,
	atacado: AtacadoPort,
	limit: number,
): Promise<number> {
	const rows = await drainOutbox(db, limit);
	let entregues = 0;
	for (const row of rows) {
		await entregarLinha(db, atacado, row); // lança em falha → aborta o batch
		entregues++;
	}
	return entregues;
}

/** Dependências injetáveis do handler de job. */
export interface OutboxWorkerDeps {
	atacado: AtacadoPort;
	db?: CoordDB;
}

/**
 * Handler puro para o job `outbox-relay` (testável sem BullMQ real). Em produção
 * é registrado num Worker da fila `outbox` (criarOutboxWorker).
 */
export async function handleOutboxRelay(
	_job: { data?: unknown },
	deps: OutboxWorkerDeps,
): Promise<{ entregues: number }> {
	const db = deps.db;
	if (!db) {
		throw new Error("handleOutboxRelay: db não injetado (composition root faltante)");
	}
	const entregues = await drenarEEntregar(db, deps.atacado, 100);
	return { entregues };
}

/**
 * Cria o worker do outbox (fila `outbox`, job `outbox-relay`). Em produção o
 * composition root injeta {atacado, db}. Não sobe aqui — retorna o Worker
 * para o caller (graceful shutdown, ADR-0002). Mantém `getQueue`/WORKER_DEFAULTS
 * no registro de retry/backoff.
 *
 * Nota: a fila `outbox` é pollada por um repeat job (intervalo curto) que
 * dispara `outbox-relay`. O repeat job é agendado pelo composition root.
 */
export function criarOutboxWorker(deps: OutboxWorkerDeps): {
	worker: Promise<import("bullmq").Worker>;
	repair: () => Promise<void>;
} {
	// Import dinâmico: o módulo de filas puxa `#/env` no top-level (env validation).
	// Manter a wiring BullMQ fora do escopo estático para que as funções puras
	// (despacharOutbox/entregarLinha/drenarEEntregar) sejam testáveis sem .env.
	// O composition root chama criarOutboxWorker (env já validado lá).
	const workerPromise = (async () => {
		const [{ Worker }, { getRedis }, { getQueue }, { QUEUE_NAMES, JOB_NAMES }] = await Promise.all([
			import("bullmq"),
			import("#/lib/redis"),
			import("#/lib/queues"),
			import("#/lib/queue-names"),
		]);
		const worker = new Worker(
			QUEUE_NAMES.OUTBOX,
			async (job) => {
				if (job.name === JOB_NAMES.OUTBOX_RELAY) {
					await handleOutboxRelay(job, deps);
				}
			},
			{ connection: getRedis() },
		);
		return worker;
	})();

	return {
		worker: workerPromise,
		async repair() {
			const { getQueue, WORKER_DEFAULTS } = await import("#/lib/queues");
			const queue = getQueue(QUEUE_NAMES.OUTBOX);
			// Repetição curta: a cada 5s drena o outbox. ADR-0002:
			// "relay lê novos registros num loop curto (poll do SQLite)".
			// bullmq 6: repeatable jobs via upsertJobScheduler (não `repeat`
			// em Queue.add — removido).
			await queue.upsertJobScheduler(
				JOB_NAMES.OUTBOX_RELAY,
				{ every: 5000 },
				{ name: JOB_NAMES.OUTBOX_RELAY, opts: { ...WORKER_DEFAULTS, removeOnComplete: true } },
			);
		},
	};
}
