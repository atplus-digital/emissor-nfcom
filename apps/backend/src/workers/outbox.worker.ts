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
import type { CoordDB } from "@emissor/db/client";
import type { AtacadoPort } from "#/domain/ports/atacado.port";
import {
	drainOutbox,
	markOutboxDone,
	markOutboxFailed,
	incOutboxAttempts,
	type OutboxRow,
} from "@emissor/db/outbox";
import { log, runWithLogContext } from "#/lib/logger";
import { QUEUE_NAMES, JOB_NAMES } from "#/lib/queue-names";

/** DB de coordenação — alinhado ao tipo aceito pelos helpers de outbox. */

/**
 * Nº máximo de tentativas de entrega antes de marcar a linha como `failed`
 * (m4 — poison guard). Acima disso a linha é terminal: não repropaga a cada
 * ciclo do relay (5s) e não é re-drenada.
 */
export const MAX_OUTBOX_ATTEMPTS = 10;

/**
 * Payload do outbox: discriminação por `op` (flat). **Deve casar exatamente**
 * com o que `src/workers/emissao.worker.ts` enfileira (`enqueueOutbox`).
 * Cada variante leva os campos nomeados que o método correspondente da
 * `AtacadoPort` consome — o dispatcher os repassa (sem `args` aninhado).
 */
export type OutboxPayload =
	| { op: "atualizarStatusFatura"; id: number; status: string }
	| {
			op: "atualizarStatusCobranca";
			id: number;
			status: string;
			extra?: { idExterno?: string; linkFatura?: string; dataEmissao?: string };
	  }
	| {
			op: "atualizarStatusNota";
			id: number;
			statusInterno?: string;
			situacao?: string;
			numero?: number;
			serie?: number;
			chave?: string;
			protocolo?: string;
			/** Ambiente SEFAZ da emissão (produção/homologação). */
			ambiente?: number;
			pdfUrl?: string;
			xmlUrl?: string;
			/** QR Code Pix da nota (campo `pix` do response `NFCom`). */
			pixUrl?: string;
	  }
	| {
			op: "registrarErro";
			cobrancaId?: number;
			notaId?: number;
			erro: string;
			mensagem: string;
			statusCode?: string;
	  };

/**
 * Despacha um payload outbox para o método correspondente de `AtacadoPort`.
 * Puro (sem I/O de SQLite) — testável isoladamente com um AtacadoPort fake.
 * Lança se `op` for desconhecido (payload corrompido). O `op` casa 1:1 com o
 * que o worker de emissão produz (revisão CRITICAL: relay e producer devem
 * falar o mesmo contrato — caso contrário nenhuma mudança de estado chega
 * ao Atacado).
 */
export async function despacharOutbox(
	atacado: AtacadoPort,
	payload: OutboxPayload,
): Promise<void> {
	switch (payload.op) {
		case "atualizarStatusFatura":
			await atacado.atualizarStatusFatura(
				payload.id,
				payload.status as Parameters<AtacadoPort["atualizarStatusFatura"]>[1],
			);
			return;
		case "atualizarStatusCobranca":
			await atacado.atualizarStatusCobranca(
				payload.id,
				payload.status as Parameters<AtacadoPort["atualizarStatusCobranca"]>[1],
				payload.extra as Parameters<AtacadoPort["atualizarStatusCobranca"]>[2],
			);
			return;
		case "atualizarStatusNota": {
			const {
				id,
				statusInterno,
				situacao,
				numero,
				serie,
				chave,
				protocolo,
				ambiente,
				pdfUrl,
				xmlUrl,
				pixUrl,
			} = payload;
			await atacado.atualizarStatusNota(id, {
				statusInterno: statusInterno as Parameters<AtacadoPort["atualizarStatusNota"]>[1]["statusInterno"],
				situacao: situacao as Parameters<AtacadoPort["atualizarStatusNota"]>[1]["situacao"],
				numero,
				serie,
				chave,
				protocolo,
				ambiente,
				pdfUrl,
				xmlUrl,
				pixUrl,
			});
			return;
		}
		case "registrarErro": {
			const { cobrancaId, notaId, erro, mensagem, statusCode } = payload;
			await atacado.registrarErro({ cobrancaId, notaId, erro, mensagem, statusCode });
			return;
		}
		default: {
			const _exhaustive: never = payload;
			const msg = `despacharOutbox: op desconhecido: ${
				(payload as { op: string }).op
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
		log.debug({ outboxId: row.id, op: payload.op }, "outbox entregue");
	} catch (err) {
		await incOutboxAttempts(db, row.id);
		log.warn(
			{ err, outboxId: row.id, op: payload.op, aggregate: row.aggregate },
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
 *
 * Poison guard (m4): uma linha com `attempts >= MAX_OUTBOX_ATTEMPTS` é
 * **falha permanente** — em vez de repropagar a cada ciclo (poison message),
 * marca `failed` (estado terminal), loga `error` e segue para a próxima linha
 * (não bloqueia o resto do batch). At-least-once preservado para attempts < MAX.
 */
export async function drenarEEntregar(
	db: CoordDB,
	atacado: AtacadoPort,
	limit: number,
): Promise<number> {
	const rows = await drainOutbox(db, limit);
	let entregues = 0;
	for (const row of rows) {
		if (row.attempts >= MAX_OUTBOX_ATTEMPTS) {
			await markOutboxFailed(db, row.id);
			log.error(
				{ outboxId: row.id, aggregate: row.aggregate, attempts: row.attempts },
				"outbox: falha permanente — marcada como failed (poison guard, sem mais retries)",
			);
			continue;
		}
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
 *
 * Popula o ALS (ADR-0008) com `fila` + `jobId` para que todo log de
 * `drenarEEntregar`/`entregarLinha` herde o contexto de correlação via mixin.
 */
export async function handleOutboxRelay(
	job: { id?: string; data?: unknown },
	deps: OutboxWorkerDeps,
): Promise<{ entregues: number }> {
	const db = deps.db;
	if (!db) {
		throw new Error("handleOutboxRelay: db não injetado (composition root faltante)");
	}
	return runWithLogContext({ fila: "outbox", jobId: job.id ?? "" }, async () => {
		const entregues = await drenarEEntregar(db, deps.atacado, 100);
		return { entregues };
	});
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
					try {
						await handleOutboxRelay(job, deps);
					} catch (err) {
						// ADR-0008: o erro final é logado UMA vez com fila+jobId; o
						// BullMQ fica responsável pelo retry (at-least-once).
						log.error(
							{ err, fila: "outbox", jobId: job.id ?? "" },
							"job outbox-relay falhou (BullMQ retenta)",
						);
						throw err; // deixa o BullMQ retryar
					}
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
