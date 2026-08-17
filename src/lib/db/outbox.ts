import { eq, asc, sql } from "drizzle-orm";
import type { CoordDB } from "#/lib/db/client";
import { outbox } from "#/lib/db/schema";

/**
 * Helpers do outbox (ADR-0003). Toda escrita de estado de emissão no Atacado sai pelo
 * outbox: a mudança de estado do job + a mensagem outbox são escritas juntas (mesma
 * transação SQLite), e um relay (fila `outbox`, ADR-0002) drena e entrega ao Atacado
 * com retry — entrega ao-menos-uma-vez, idempotente por update por id.
 */

export interface OutboxMessage {
	aggregate: string;
	aggregateId: number;
	payload: unknown;
}

export interface OutboxRow {
	id: number;
	aggregate: string;
	aggregateId: number;
	payload: unknown;
	status: string;
	attempts: number;
	createdAt: string;
}

type DB = CoordDB;

function nowISO(): string {
	return new Date().toISOString();
}

/**
 * Enfileira uma mensagem no outbox (status `pending`).
 */
export async function enqueueOutbox(db: DB, msg: OutboxMessage): Promise<void> {
	await db.insert(outbox).values({
		aggregate: msg.aggregate,
		aggregateId: msg.aggregateId,
		payload: JSON.stringify(msg.payload),
		status: "pending",
		attempts: 0,
		createdAt: nowISO(),
	});
}

/**
 * Drena até `limit` mensagens pendentes, na ordem por id (mais antiga primeiro).
 * O relay é responsável por marcar done / incrementar tentativas após a entrega.
 */
export async function drainOutbox(db: DB, limit: number): Promise<OutboxRow[]> {
	const rows = await db
		.select()
		.from(outbox)
		.where(eq(outbox.status, "pending"))
		.orderBy(asc(outbox.id))
		.limit(limit);
	return rows.map((r) => ({
		id: r.id,
		aggregate: r.aggregate,
		aggregateId: r.aggregateId,
		payload: JSON.parse(r.payload),
		status: r.status,
		attempts: r.attempts,
		createdAt: r.createdAt,
	}));
}

/**
 * Marca uma mensagem outbox como entregue (`done`).
 */
export async function markOutboxDone(db: DB, id: number): Promise<void> {
	await db.update(outbox).set({ status: "done" }).where(eq(outbox.id, id));
}

/**
 * Incrementa o contador de tentativas de entrega (para observabilidade/backoff).
 */
export async function incOutboxAttempts(db: DB, id: number): Promise<void> {
	// Incremento atômico via SQL para evitar race entre o relay e retries.
	await db.run(sql`UPDATE outbox SET attempts = attempts + 1 WHERE id = ${id}`);
}
