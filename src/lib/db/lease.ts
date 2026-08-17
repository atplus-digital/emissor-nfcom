import { eq } from "drizzle-orm";
import type { CoordDB } from "#/lib/db/client";
import { faturaLease } from "#/lib/db/schema";

/**
 * Lease de coordenação por fatura (ADR-0003 item 3). O job `emit-fatura` adquire o
 * lease `fatura:{id}:emitir` ao iniciar; um novo job só reassume se o anterior for
 * detectado como morto (BullMQ stalled/failed), não por relógio.
 *
 * `acquireLease` é ATÔMICA: `INSERT ... ON CONFLICT DO NOTHING` + verifica se a
 * inserção realmente aconteceu (revisão M1). Retorna `true` apenas se ESTA chamada
 * inseriu a row; se o lease já existia, retorna `false` (outro é dono). A lógica de
 * "reassume se morto" (liberar o lease de um job stalled) é responsabilidade do
 * worker, que decide quando é seguro chamar `releaseLease` antes de `acquireLease`.
 */

type DB = CoordDB;

function nowISO(): string {
	return new Date().toISOString();
}

/**
 * Tenta adquirir o lease da fatura de forma ATÔMICA. Retorna `true` se ESTA chamada
 * inseriu a row (fatura estava livre), `false` se o lease já existia.
 */
export async function acquireLease(db: DB, faturaId: number): Promise<boolean> {
	const result = await db
		.insert(faturaLease)
		.values({ faturaId, emitindoSince: nowISO() })
		.onConflictDoNothing()
		.returning();
	// returning() no libsql/drizzle: row de volta só se a inserção aconteceu.
	return result.length > 0;
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
