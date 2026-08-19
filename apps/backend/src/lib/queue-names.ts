/**
 * Nomes canônicos de filas e jobs BullMQ (ADR-0002).
 *
 * Filas (agrupam jobs por gateway/destino p/ rate-limit independente):
 * - `emissao`  — jobs da árvore de emissão (fatura → cobrança → nfcom)
 * - `outbox`   — drena o outbox do SQLite e entrega ao Atacado (entrega ao-menos-uma-vez)
 * - `webhook`  — empurra eventos de estado ao cliente (SPEC-0001 passo 6)
 *
 * Jobs (nomes estáveis p/ filiação parent/child via Flows):
 * - `emit-fatura` (parent da árvore), `emit-cobranca` (child do parent),
 *   `emit-nfcom` (child do seu `emit-cobranca`) — árvore `emit-fatura → emit-cobranca
 *   → emit-nfcom` (ADR-0002).
 * - `outbox-relay` (drain do outbox), `webhook-send` (entrega de evento).
 */
export const QUEUE_NAMES = {
	EMISSAO: "emissao",
	OUTBOX: "outbox",
	WEBHOOK: "webhook",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const JOB_NAMES = {
	EMIT_FATURA: "emit-fatura",
	EMIT_COBRANCA: "emit-cobranca",
	EMIT_NFCOM: "emit-nfcom",
	OUTBOX_RELAY: "outbox-relay",
	WEBHOOK_SEND: "webhook-send",
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];
