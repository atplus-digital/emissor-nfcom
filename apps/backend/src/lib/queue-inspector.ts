/**
 * Inspetor de filas BullMQ — observabilidade do painel (GET /painel/api/filas).
 *
 * `montarSnapshotFilas` é lógica pura sobre instâncias `Queue` (testável com
 * fakes, sem Redis); `inspecionarFilas` liga as filas canônicas via `getQueue`
 * — o entrypoint de produção. O snapshot já sai na forma que o viewer consome
 * (a rota o serializa direto — sem serializer separado, dado que é 1:1).
 *
 * `contagens` usa as chaves cruas do BullMQ (`getJobCounts`): `waiting`,
 * `active`, `delayed`, `completed`, `failed` (+ `prioritized`/
 * `waiting-children`/`paused` quando houver).
 */
import type { Job, JobType, Queue } from "bullmq";
import { QUEUE_NAMES, type QueueName } from "#/lib/queue-names";
import { getQueue } from "#/lib/queues";

/** Estados coletados por fila (os que importam p/ monitoração em tempo real). */
const ESTADOS: JobType[] = [
	"waiting",
	"active",
	"delayed",
	"failed",
	"completed",
];

/** Job na forma que o viewer consome (a rota serializa direto). */
export interface JobFilaView {
	id: string;
	nome: string;
	estado: JobType;
	/** Tentativas já feitas (attemptsMade). */
	tentativas: number;
	/** Criação do job (ms epoch). */
	criadoEm: number;
	/** Último início de processamento (ms epoch) — null se nunca processado. */
	processadoEm: number | null;
	/** Conclusão/falha (ms epoch) — null enquanto pendente/em curso. */
	finalizadoEm: number | null;
	/** Motivo da falha (jobs failed). */
	falha: string | null;
	/** `faturaId` do data do job (melhor esforço — só jobs de emissão levam). */
	faturaId: number | null;
	/** Id do job pai (árvore de emissão, ADR-0002). */
	paiId: string | null;
}

export interface FilaView {
	nome: QueueName;
	/** Contagens cruas por estado (chaves do `getJobCounts`). */
	contagens: Record<string, number>;
	pausada: boolean;
	workers: number;
	/** Jobs recentes por estado (até `limite` por estado). */
	jobs: JobFilaView[];
}

export interface FilasSnapshot {
	/** Geração do snapshot (ms epoch). */
	geradoEm: number;
	filas: FilaView[];
}

/** Serializa um Job na view (o estado vem da query — sem chamada extra ao Redis). */
function serializarJob(job: Job, estado: JobType): JobFilaView {
	const data = (job.data ?? {}) as { faturaId?: unknown };
	return {
		id: job.id ?? "",
		nome: job.name,
		estado,
		tentativas: job.attemptsMade,
		criadoEm: job.timestamp,
		processadoEm: job.processedOn ?? null,
		finalizadoEm: job.finishedOn ?? null,
		falha: job.failedReason || null,
		faturaId: typeof data.faturaId === "number" ? data.faturaId : null,
		paiId: job.parent?.id ?? null,
	};
}

async function montarFila(
	nome: QueueName,
	queue: Queue,
	limite: number,
): Promise<FilaView> {
	const [contagens, pausada, workers, porEstado] = await Promise.all([
		queue.getJobCounts(),
		queue.isPaused(),
		// `getWorkers` é GETCLIENTS-based e pode não suportar em alguns
		// provedores (ex.: GCP, sem SETNAME) — o monitor segue com 0.
		queue
			.getWorkers()
			.then((lista) => lista.length)
			.catch(() => 0),
		Promise.all(
			ESTADOS.map((estado) => queue.getJobs([estado], 0, limite - 1, true)),
		),
	]);
	const jobs = porEstado.flatMap((lista, i) =>
		lista.map((job) => serializarJob(job, ESTADOS[i]!)),
	);
	return { nome, contagens, pausada, workers, jobs };
}

/**
 * Monta o snapshot de uma lista de filas. `limite` = máx. de jobs POR ESTADO
 * (default 50 — o painel é monitor, não despejo exaustivo da fila).
 */
export async function montarSnapshotFilas(
	alvos: { nome: QueueName; queue: Queue }[],
	limite = 50,
): Promise<FilasSnapshot> {
	const filas = await Promise.all(
		alvos.map((alvo) => montarFila(alvo.nome, alvo.queue, limite)),
	);
	return { geradoEm: Date.now(), filas };
}

/** Entrypoint de produção: filas canônicas (emissao/outbox/webhook) via `getQueue`. */
export function inspecionarFilas(limite?: number): Promise<FilasSnapshot> {
	const alvos = (Object.values(QUEUE_NAMES) as QueueName[]).map((nome) => ({
		nome,
		queue: getQueue(nome),
	}));
	return montarSnapshotFilas(alvos, limite);
}
