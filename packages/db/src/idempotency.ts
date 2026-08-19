import { eq, sql } from "drizzle-orm";
import type { CoordDB } from "./client";
import { idempotencyKeys } from "./schema";

/**
 * Helpers de idempotência (ADR-0003). Antes de chamar um serviço externo (Asaas/NFCom),
 * o job adquire a key determinística. Estados:
 * - in_progress (sem external_id): escrita em curso; outro acquire retorna in_progress
 *   com `acquired=false` (caller decide retry/fail), NÃO re-emite.
 * - resolved (com external_id): já feita; acquire retorna o external_id para reuso.
 *
 * `acquireKey` é ATÔMICO: usa `INSERT ... ON CONFLICT(key) DO NOTHING` + re-read. Dois
 * callers concorrentes na mesma key → exatamente um insere (`acquired=true`); o outro
 * re-lê e vê `in_progress` com `acquired=false` (não adquiriu — outro é dono). Isso
 * fecha o race TOCTOU que poderia duplicar boleto/nota (revisão C1).
 *
 * Nota sobre o "buraco pós-POST" (ADR-0003 item 4): a key local não cobre o crash
 * entre o POST e a resolução. O tratamento é por serviço (Asaas consulta por
 * externalReference; NFCom não re-emite → inspeção), decidido em SPEC/worker — não aqui.
 */

export type IdempotencyAcquire = {
	status: "in_progress";
	externalId: null;
	/** true se ESTA chamada inseriu a key (é a dona); false se já existia (outro é dono). */
	acquired: boolean;
} | {
	status: "resolved";
	externalId: string;
	/** reuso de key já resolvida — `acquired=false` (não foi uma aquisição nova). */
	acquired: false;
};

export interface IdempotencyKeyRow {
	key: string;
	target: string;
	externalId: string | null;
	status: string;
}

type DB = CoordDB;

function nowISO(): string {
	// Data de domínio em UTC ISO no wire; o fuso America/Sao_Paulo é para datas puras
	// (CONVENTIONS). Timestamps de coordenação são ISO UTC.
	return new Date().toISOString();
}

/**
 * Adquire uma idempotency key de forma ATÔMICA. Tenta inserir com
 * `ON CONFLICT(key) DO NOTHING`; se a inserção acontecer (`changes===1`), esta
 * chamada é a dona (`acquired=true`). Se a key já existia, re-lê para determinar o
 * estado (resolved → reuso; in_progress → não adquiriu, outro é dono).
 */
export async function acquireKey(
	db: DB,
	key: string,
	target: string,
): Promise<IdempotencyAcquire> {
	const ts = nowISO();
	const result = await db
		.insert(idempotencyKeys)
		.values({ key, target, status: "in_progress", externalId: null, createdAt: ts, updatedAt: ts })
		.onConflictDoNothing()
		.returning();

	// returning() no libsql/drizzle: se a inserção aconteceu, retorna a row; se
	// onConflictDoNothing no-op, retorna [].
	if (result.length > 0) {
		return { status: "in_progress", externalId: null, acquired: true };
	}

	// A key já existia — re-lê para classificar (resolved vs in_progress de outro).
	const existing = await getKey(db, key);
	if (existing && existing.status === "resolved" && existing.externalId !== null) {
		return { status: "resolved", externalId: existing.externalId, acquired: false };
	}
	// in_progress de outro caller (ou estado inesperado) — não adquiriu.
	return { status: "in_progress", externalId: null, acquired: false };
}

/**
 * Resolve a key: registra o external_id retornado pelo serviço e marca `resolved`.
 */
export async function resolveKey(
	db: DB,
	key: string,
	externalId: string,
): Promise<void> {
	await db
		.update(idempotencyKeys)
		.set({ externalId, status: "resolved", updatedAt: nowISO() })
		.where(eq(idempotencyKeys.key, key));
}

/**
 * Lê uma key (ou null se inexistente).
 */
export async function getKey(db: DB, key: string): Promise<IdempotencyKeyRow | null> {
	const rows = await db
		.select()
		.from(idempotencyKeys)
		.where(eq(idempotencyKeys.key, key));
	const r = rows[0];
	if (!r) return null;
	return {
		key: r.key,
		target: r.target,
		externalId: r.externalId ?? null,
		status: r.status,
	};
}
