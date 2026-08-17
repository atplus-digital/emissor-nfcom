import { eq } from "drizzle-orm";
import type { CoordDB } from "#/lib/db/client";
import { idempotencyKeys } from "#/lib/db/schema";

/**
 * Helpers de idempotência (ADR-0003). Antes de chamar um serviço externo (Asaas/NFCom),
 * o job adquire a key determinística. Estados:
 * - in_progress (sem external_id): escrita em curso; outro acquire retorna in_progress
 *   (caller decide retry/fail), NÃO re-emite.
 * - resolved (com external_id): já feita; acquire retorna o external_id para reuso.
 *
 * Nota sobre o "buraco pós-POST" (ADR-0003 item 4): a key local não cobre o crash
 * entre o POST e a resolução. O tratamento é por serviço (Asaas consulta por
 * externalReference; NFCom não re-emite → inspeção), decidido em SPEC/worker — não aqui.
 */

export type IdempotencyAcquire =
	| { status: "in_progress"; externalId: null }
	| { status: "resolved"; externalId: string };

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
 * Adquire uma idempotency key. Se a key não existe, insere como `in_progress`.
 * Se existe e está `resolved`, retorna o external_id (caminho de reuso — não re-chama
 * o serviço). Se existe e está `in_progress`, retorna `in_progress` (caller retry/fail).
 */
export async function acquireKey(
	db: DB,
	key: string,
	target: string,
): Promise<IdempotencyAcquire> {
	const existing = await getKey(db, key);
	if (existing) {
		if (existing.status === "resolved" && existing.externalId !== null) {
			return { status: "resolved", externalId: existing.externalId };
		}
		return { status: "in_progress", externalId: null };
	}
	const ts = nowISO();
	await db
		.insert(idempotencyKeys)
		.values({ key, target, status: "in_progress", externalId: null, createdAt: ts, updatedAt: ts });
	return { status: "in_progress", externalId: null };
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
