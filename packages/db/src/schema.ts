import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/**
 * Schema de coordenação do SQLite local (ADR-0003).
 *
 * O SQLite guarda APENAS metadado de coordenação de emissão — nunca define o que é
 * uma fatura (fonte de domínio = CRM Atacado). As três tabelas:
 *
 * - `idempotency_keys`: dedup de escrita externa (boleto Asaas / nota NFCom). Antes de
 *   chamar o serviço, o job adquire a key; se resolvida com external_id, reusa sem
 *   re-chamar. Key determinística, ex.: `cobranca:{id}:boleto`, `nfcom:{id}:emitir`.
 * - `outbox`: mensagens de mudança de estado a aplicar no Atacado (entrega
 *   ao-menos-uma-vez, idempotente por update por id; drenada pelo relay, ADR-0002).
 * - `fatura_lease`: coordenação por fatura — um job `emit-fatura` adquire o lease
 *   `fatura:{id}:emitir` ao iniciar; só reassume se o anterior for detectado como
 *   morto (BullMQ stalled/failed), não por relógio.
 *
 * Migrations são GERADAS por `bunx drizzle-kit generate` (ADR-0009) — nunca editar o
 * SQL em `drizzle/` à mão.
 */

/// Chaves de idempotência (dedup de escrita externa).
export const idempotencyKeys = sqliteTable("idempotency_keys", {
	key: text("key").primaryKey(),
	target: text("target").notNull(),
	externalId: text("external_id"),
	status: text("status").notNull().default("in_progress"),
	createdAt: text("created_at").notNull(),
	updatedAt: text("updated_at").notNull(),
});

/// Outbox (entrega de estado ao Atacado).
export const outbox = sqliteTable("outbox", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	aggregate: text("aggregate").notNull(),
	aggregateId: integer("aggregate_id").notNull(),
	payload: text("payload").notNull(),
	status: text("status").notNull().default("pending"),
	attempts: integer("attempts").notNull().default(0),
	createdAt: text("created_at").notNull(),
});

/// Lease de fatura (coordenação de emissão).
export const faturaLease = sqliteTable("fatura_lease", {
	faturaId: integer("fatura_id").primaryKey(),
	emitindoSince: text("emitindo_since").notNull(),
});
