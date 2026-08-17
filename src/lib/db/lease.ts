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

/**
 * Lê o `emitindo_since` do lease (ou `null` se não houver lease).
 */
export async function lerLeaseDesde(
	db: DB,
	faturaId: number,
): Promise<string | null> {
	const rows = await db
		.select({ emitindoSince: faturaLease.emitindoSince })
		.from(faturaLease)
		.where(eq(faturaLease.faturaId, faturaId));
	return rows.length > 0 ? (rows[0]?.emitindoSince ?? null) : null;
}

/**
 * Reassume um lease stale (SPEC-0001 caso 2). Se o lease está sendo há mais que
 * `limiteMs` (job anterior presume-se morto — BullMQ stalled/failed sem liberar),
 * libera e re-adquire; retorna `true` se reassumiu. Se o lease é recente (ainda
 * ativo) ou não existe, retorna `false` (caller deve pular).
 *
 * O ADR-0003 prefere detecção via BullMQ stalled (não relógio); este limiar de
 * tempo é o fallback pragmático quando não há como consultar o estado do job
 * dentro do handler puro. O composition root pode injetar `limiteMs` conforme o
 * `stalledInterval`/`maxStalledCount` do BullMQ.
 */
export async function reassumirLeaseSeStale(
	db: DB,
	faturaId: number,
	limiteMs: number,
	now: () => string = () => new Date().toISOString(),
): Promise<boolean> {
	const desde = await lerLeaseDesde(db, faturaId);
	if (desde === null) {
		// sem lease → acquireLease direto já resolveria; aqui retorna false p/ o
		// caller tentar acquireLease (ou reassumir via acquireLease).
		return false;
	}
	const idadeMs = Date.parse(now()) - Date.parse(desde);
	if (Number.isNaN(idadeMs) || idadeMs < limiteMs) {
		return false; // lease ainda ativo
	}
	// stale: libera e re-adquire.
	await releaseLease(db, faturaId);
	const readquirido = await acquireLease(db, faturaId);
	return readquirido;
}
