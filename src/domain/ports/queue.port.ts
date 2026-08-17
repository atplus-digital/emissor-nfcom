/**
 * Porta de filas (BullMQ — ADR-0002).
 *
 * Abstrai o BullMQ para que o domínio não importe `bullmq` direto (regra
 * ADR-0004/0007). Workers (Fase 4) ligam a porta ao BullMQ no composition
 * root. A rota HTTP enfileira `emit-fatura` por aqui; o worker de emissão
 * enfileira jobs filhos (cobrança/nota) internamente.
 */
import type { EventoWebhook } from "#/domain/types";

export interface QueuePort {
	/** Enfileira o job parent `emit-fatura` (SPEC-0001 passo 1 → 202). */
	enfileirarEmissaoFatura(faturaId: number): Promise<{ jobId: string }>;
	/** Enfileira evento de webhook (fila `webhook`, SPEC-0001 passo 6). */
	enfileirarWebhook(evento: EventoWebhook): Promise<void>;
}
