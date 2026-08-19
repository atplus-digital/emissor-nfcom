import { Queue, Worker } from "bullmq";
import { getRedis } from "#/lib/redis";
import { QUEUE_NAMES, type QueueName } from "#/lib/queue-names";

/**
 * Fábrica de filas BullMQ (ADR-0002). Filas são cacheadas por nome no processo.
 *
 * Rate-limit por gateway (ADR-0002): a árvore de emissão vive numa ÚNICA fila
 * `emissao` porque BullMQ Flows exige parent/child na MESMA fila — separar por
 * provedor quebraria o Flow. Por isso o rate-limit por gateway NÃO é feito na fila:
 * é aplicado **na chamada externa** via `RateLimiter` por provedor (`src/lib/rate-limit.ts`),
 * com a env `RATE_LIMIT_*` de cada um, no composition root (`src/index.ts`).
 * Ver `emissao.worker.ts` p/ o wiring.
 */

/**
 * Defaults de worker de emissão (ADR-0002): 5 tentativas com backoff exponencial.
 * Exauridas, o item vai para `erro` via outbox e o job fica `failed` no BullMQ — sem
 * DLQ dedicada.
 */
export const WORKER_DEFAULTS = {
	attempts: 5,
	backoff: { type: "exponential" },
} as const;

const _queues = new Map<QueueName, Queue>();

/** Retorna (e cacheia) uma Queue BullMQ pelo nome. */
export function getQueue(name: QueueName): Queue {
	const cached = _queues.get(name);
	if (cached) return cached;
	const queue = new Queue(name, { connection: getRedis() });
	_queues.set(name, queue);
	return queue;
}

/**
 * Graceful shutdown (ADR-0002): drena cada worker em andamento com timeout controlado
 * (default 30s) antes de sair. `Promise.all` para drenagem paralela; o `timeoutMs` é
 * aplicado por worker via AbortSignal/timeout individual.
 */
export async function gracefulShutdown(
	workers: Worker[],
	timeoutMs = 30_000,
): Promise<void> {
	await Promise.all(
		workers.map((w) =>
			Promise.race([
				w.close(),
				new Promise<void>((_, reject) =>
					setTimeout(
						() => reject(new Error(`worker close timeout ${timeoutMs}ms`)),
						timeoutMs,
					),
				),
			]).catch(() => {
				/* timeout de drenagem exaurido — segue o shutdown */
			}),
		),
	);
}
