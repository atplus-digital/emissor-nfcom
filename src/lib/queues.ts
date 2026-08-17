import { Queue, Worker } from "bullmq";
import { env } from "#/env";
import { getRedis } from "#/lib/redis";
import { QUEUE_NAMES, type QueueName } from "#/lib/queue-names";

/**
 * Fábrica de filas BullMQ (ADR-0002). Filas são cacheadas por nome no processo.
 *
 * Rate-limit por gateway (ADR-0002): o rate-limiter do BullMQ é **por fila**. A fila
 * agrupa jobs cujas escritas externas tocam primariamente um provedor, e o limite da
 * fila aproxima o limite do provedor. `rateLimitFor(provider)` devolve as opções de
 * rate-limit para o provedor a partir das envs `RATE_LIMIT_*` (req/s → max/duration ms).
 * Workers (Fase 4) aplicam o rate-limit apropriado ao construírem o Worker; se um
 * provedor vier a ser tocado de duas filas, o limite agregado é a soma das filas —
 * observar em produção (429s).
 */

export type GatewayProvider = "asaas" | "nfcom" | "atacado";

/**
 * Opções de rate-limit do BullMQ para um provedor, derivadas das envs (req/s).
 * `max` = requisições no `duration` (ms). 1 req/s → max 1 / 1000 ms.
 */
export function rateLimitFor(provider: GatewayProvider): {
	max: number;
	duration: number;
} {
	const max =
		provider === "asaas"
			? env.RATE_LIMIT_ASAAS
			: provider === "nfcom"
				? env.RATE_LIMIT_NFCOM
				: env.RATE_LIMIT_ATACADO;
	return { max, duration: 1000 };
}

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
