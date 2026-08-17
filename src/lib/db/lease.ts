import { eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { faturaLease } from "#/lib/db/schema";

/**
 * Lease de coordenação por fatura (ADR-0003 item 3). O job `emit-fatura` adquire o
 * lease `fatura:{id}:emitir` ao iniciar; um novo job só reassume se o anterior for
 * detectado como morto (BullMQ stalled/failed), não por relógio.
 *
 * `acquireLease` aqui é a primitiva de insert-or-conflict: se a fatura já tem lease,
 * retorna `false` (não adquirido). A lógica de "reassume se morto" (liberar o lease de
 * um job stalled) é responsabilidade do worker, que decide quando é seguro chamar
 * `releaseLease` antes de `acquireLease` — não deste helper de baixo nível.
 */

type DB = LibSQLDatabase<Record<string, never>>;

function nowISO(): string {
	return new Date().toISOString();
}

/**
 * Tenta adquirir o lease da fatura. Retorna `true` se adquirido (fatura estava livre),
 * `false` se já existe lease ativo.
 */
export async function acquireLease(db: DB, faturaId: number): Promise<boolean> {
	// Insert-or-ignore: se já existe row com essa PK, não insere (não conflita).
	// libsql/drizzle: onConflictDoNothing na PK.
	const existing = await hasLease(db, faturaId);
	if (existing) return false;
	await db
		.insert(faturaLease)
		.values({ faturaId, emitindoSince: nowISO() })
		.onConflictDoNothing();
	return true;
}

/**
 * Libera o lease (remove a row). Usado pelo worker ao terminar (sucesso/falha) ou ao
 * reassumir um job stalled detectado como morto.
 */
export async function releaseLease(db: DB, faturaId: number): Promise<void> {
	await db.delete(faturaLease).where(eq(faturaLease.faturaId, faturaId));
}

/**
 * Indica se a fatura tem lease ativo.
 */
export async function hasLease(db: DB, faturaId: number): Promise<boolean> {
	const rows = await db
		.select()
		.from(faturaLease)
		.where(eq(faturaLease.faturaId, faturaId));
	return rows.length > 0;
}
