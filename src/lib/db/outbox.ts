import { eq, sql } from "drizzle-orm";
import type { CoordDB } from "#/lib/db/client";
import { outbox } from "#/lib/db/schema";

/**
 * Helpers do outbox (ADR-0003). Toda escrita de estado de emissão no Atacado sai pelo
 * outbox: a mudança de estado do job + a mensagem outbox são escritas juntas (mesma
 * transação SQLite), e um relay (fila `outbox`, ADR-0002) drena e entrega ao Atacado
 * com retry — entrega ao-menos-uma-vez, idempotente por update por id.
 *
 * `drainOutbox` é ATÔMICO (revisão M2): reivindica (`claim`) as rows mudando status
 * `pending → processing` num UPDATE atômico com RETURNING, de modo que dois relays
 * concorrentes não entregam a mesma row. A entrega é ao-menos-uma-vez; a
 * idempotência reside no Atacado (update por id). Em falha, `incOutboxAttempts`
 * devolve a row a `pending` (para retry).
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
 * Drena até `limit` mensagens, **reivindicando-as atomicamente** (`pending → processing`).
 * Dois drains concorrentes não recebem a mesma row (cada row é claimada por um só).
 * O relay marca `markOutboxDone` após entrega com sucesso; em falha, `incOutboxAttempts`
 * devolve a row a `pending`.
 */
export async function drainOutbox(db: DB, limit: number): Promise<OutboxRow[]> {
	// Atomic claim: UPDATE ... WHERE id IN (SELECT pending ORDER BY id LIMIT ?) RETURNING *.
	// O subselect + update atômico evita a race do SELECT-then-act. Usamos o query
	// builder .returning() do drizzle (API tipada que devolve as rows), sobre a
	// subquery de claim.
	const claimed = await db
		.update(outbox)
		.set({ status: "processing" })
		.where(
			sql`id IN (SELECT id FROM outbox WHERE status='pending' ORDER BY id LIMIT ${limit})`,
		)
		.returning();
	return claimed.map((r) => ({
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
 * Marca uma mensagem outbox como `failed` (estado terminal, m4 poison guard).
 * `status` é texto livre no schema (sem CHECK constraint), então `failed` não
 * exige migration. `drainOutbox` só reivindica `pending`, logo uma row `failed`
 * nunca volta ao ciclo — evita poison message (falha permanente repropagando a
 * cada 5s).
 */
export async function markOutboxFailed(db: DB, id: number): Promise<void> {
	await db.update(outbox).set({ status: "failed" }).where(eq(outbox.id, id));
}

/**
 * Incrementa o contador de tentativas e **devolve a row a `pending`** (para retry).
 */
export async function incOutboxAttempts(db: DB, id: number): Promise<void> {
	// Incremento atômico; volta a `pending` para o relay tentar de novo no próximo ciclo.
	await db.run(
		sql`UPDATE outbox SET attempts = attempts + 1, status='pending' WHERE id = ${id}`,
	);
}
