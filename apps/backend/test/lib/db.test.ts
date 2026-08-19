import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { sql } from "drizzle-orm";
import { rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "@emissor/db/schema";
import {
	acquireKey,
	resolveKey,
	getKey,
} from "@emissor/db/idempotency";
import {
	enqueueOutbox,
	drainOutbox,
	markOutboxDone,
	markOutboxFailed,
	incOutboxAttempts,
} from "@emissor/db/outbox";
import { acquireLease, releaseLease, hasLease } from "@emissor/db/lease";

/**
 * Cria um DB SQLite efêmero (arquivo temp único) e aplica as migrations geradas
 * (drizzle/meta/_journal.json + drizzle/*.sql). Cada teste ganha um DB limpo.
 */
function makeDb(): LibSQLDatabase<typeof schema> {
	const dir = join(tmpdir(), `emissor-test-${Math.random().toString(36).slice(2)}`);
	mkdirSync(dir, { recursive: true });
	const file = join(dir, "coord.db");
	// libsql exige scheme `file:` para caminhos locais.
	const db = drizzle({ connection: `file:${file}`, schema });
	migrate(db, { migrationsFolder: "./drizzle" });
	return db;
}

let db: LibSQLDatabase<typeof schema>;

beforeEach(() => {
	db = makeDb();
});

afterEach(() => {
	// libsql mantém o arquivo aberto no cliente; derrubar a conexão não é exposto
	// de forma trivial — o arquivo temp fica órfão em /tmp (coletado pelo SO).
});

describe("schema: tabelas de coordenação (ADR-0003)", () => {
	test("idempotency_keys existe após a migration", async () => {
		const rows = await db.all(
			sql`SELECT name FROM sqlite_master WHERE type='table' AND name='idempotency_keys'`,
		);
		expect(rows.length).toBe(1);
	});

	test("outbox existe após a migration", async () => {
		const rows = await db.all(
			sql`SELECT name FROM sqlite_master WHERE type='table' AND name='outbox'`,
		);
		expect(rows.length).toBe(1);
	});

	test("fatura_lease existe após a migration", async () => {
		const rows = await db.all(
			sql`SELECT name FROM sqlite_master WHERE type='table' AND name='fatura_lease'`,
		);
		expect(rows.length).toBe(1);
	});
});

describe("idempotency: acquireKey / resolveKey / getKey", () => {
	test("acquireKey em key nova → in_progress, acquired=true (é a dona)", async () => {
		const r = await acquireKey(db, "cobranca:42:boleto", "asaas.boleto");
		expect(r.status).toBe("in_progress");
		expect(r.externalId).toBeNull();
		expect(r.acquired).toBe(true);
	});

	test("acquireKey na mesma key novamente → in_progress, acquired=false (outro é dono)", async () => {
		await acquireKey(db, "cobranca:42:boleto", "asaas.boleto");
		const r = await acquireKey(db, "cobranca:42:boleto", "asaas.boleto");
		expect(r.status).toBe("in_progress");
		expect(r.externalId).toBeNull();
		expect(r.acquired).toBe(false);
	});

	test("resolveKey → status resolved + external_id persistido", async () => {
		await acquireKey(db, "cobranca:42:boleto", "asaas.boleto");
		await resolveKey(db, "cobranca:42:boleto", "pay_abc123");
		const k = await getKey(db, "cobranca:42:boleto");
		expect(k?.status).toBe("resolved");
		expect(k?.externalId).toBe("pay_abc123");
	});

	test("acquireKey em key já resolvida → retorna external_id (reuso, acquired=false)", async () => {
		await acquireKey(db, "cobranca:42:boleto", "asaas.boleto");
		await resolveKey(db, "cobranca:42:boleto", "pay_abc123");
		const r = await acquireKey(db, "cobranca:42:boleto", "asaas.boleto");
		expect(r.status).toBe("resolved");
		expect(r.externalId).toBe("pay_abc123");
		expect(r.acquired).toBe(false);
	});

	test("getKey em key inexistente → null", async () => {
		const k = await getKey(db, "inexistente");
		expect(k).toBeNull();
	});

	test("C1: dois acquireKey concorrentes na mesma key → exatamente um acquired=true", async () => {
		// Race simulada: dois acquireKey "simultâneos" (Promise.all). O INSERT atômico
		// com ON CONFLICT DO NOTHING garante que só um insere; o outro re-lê in_progress
		// com acquired=false. Sem o fix, ambos poderiam passar e duplicar a escrita.
		const [a, b] = await Promise.all([
			acquireKey(db, "cobranca:99:boleto", "asaas.boleto"),
			acquireKey(db, "cobranca:99:boleto", "asaas.boleto"),
		]);
		const acquired = [a.acquired, b.acquired].filter(Boolean);
		expect(acquired.length).toBe(1);
		const owners = [a, b].filter((r) => r.acquired);
		expect(owners[0].status).toBe("in_progress");
		const non = [a, b].filter((r) => !r.acquired);
		expect(non[0].status).toBe("in_progress");
	});
});

describe("outbox: enqueue / drain / markDone / incAttempts", () => {
	test("enqueueOutbox insere pending; drainOutbox reivindica (status processing)", async () => {
		await enqueueOutbox(db, {
			aggregate: "fatura",
			aggregateId: 1,
			payload: { foo: "bar" },
		});
		const pending = await drainOutbox(db, 10);
		expect(pending.length).toBe(1);
		expect(pending[0].aggregate).toBe("fatura");
		expect(pending[0].status).toBe("processing");
		expect(pending[0].attempts).toBe(0);
	});

	test("drainOutbox retorna na ordem por id (mais antigo primeiro)", async () => {
		await enqueueOutbox(db, { aggregate: "fatura", aggregateId: 1, payload: {} });
		await enqueueOutbox(db, { aggregate: "fatura", aggregateId: 2, payload: {} });
		const pending = await drainOutbox(db, 10);
		expect(pending.map((p) => p.aggregateId)).toEqual([1, 2]);
	});

	test("markOutboxDone → status done → não retorna no próximo drain", async () => {
		await enqueueOutbox(db, { aggregate: "fatura", aggregateId: 1, payload: {} });
		const pending = await drainOutbox(db, 10);
		await markOutboxDone(db, pending[0].id);
		const next = await drainOutbox(db, 10);
		expect(next.length).toBe(0);
	});

	test("m4: markOutboxFailed → status failed → não retorna no próximo drain (estado terminal)", async () => {
		await enqueueOutbox(db, { aggregate: "fatura", aggregateId: 1, payload: {} });
		const claimed = await drainOutbox(db, 10); // → processing
		await markOutboxFailed(db, claimed[0].id);
		const next = await drainOutbox(db, 10);
		expect(next.length).toBe(0);
	});

	test("incOutboxAttempts incrementa o contador e devolve a pending", async () => {
		await enqueueOutbox(db, { aggregate: "fatura", aggregateId: 1, payload: {} });
		const claimed = await drainOutbox(db, 10); // → processing
		await incOutboxAttempts(db, claimed[0].id); // → pending + attempts+1
		const again = await drainOutbox(db, 10);
		expect(again[0].attempts).toBe(1);
		expect(again[0].status).toBe("processing"); // re-claimada
	});

	test("M2: dois drains concorrentes — nenhuma row claimada por ambos", async () => {
		await enqueueOutbox(db, { aggregate: "fatura", aggregateId: 1, payload: {} });
		await enqueueOutbox(db, { aggregate: "fatura", aggregateId: 2, payload: {} });
		await enqueueOutbox(db, { aggregate: "fatura", aggregateId: 3, payload: {} });
		const [a, b] = await Promise.all([drainOutbox(db, 2), drainOutbox(db, 2)]);
		const idsA = a.map((r) => r.id);
		const idsB = b.map((r) => r.id);
		// Sem claim atômico, os dois drains pegariam as mesmas rows. Com claim, não há
		// intersecção.
		const intersecao = idsA.filter((id) => idsB.includes(id));
		expect(intersecao.length).toBe(0);
		// Juntos cobrem até 3 rows (limit 2 cada, mas só há 3 pending).
		expect(new Set([...idsA, ...idsB]).size).toBeGreaterThanOrEqual(3);
	});

	test("payload é serializado como JSON e recuperável", async () => {
		await enqueueOutbox(db, {
			aggregate: "nota",
			aggregateId: 7,
			payload: { chave: "123", total: 99 },
		});
		const pending = await drainOutbox(db, 10);
		expect(pending[0].payload).toEqual({ chave: "123", total: 99 });
	});
});

describe("fatura_lease: acquireLease / releaseLease / hasLease", () => {
	test("acquireLease em fatura livre → adquirido; hasLease true", async () => {
		const got = await acquireLease(db, 101);
		expect(got).toBe(true);
		expect(await hasLease(db, 101)).toBe(true);
	});

	test("acquireLease em fatura já com lease → não adquirido", async () => {
		await acquireLease(db, 101);
		const got = await acquireLease(db, 101);
		expect(got).toBe(false);
	});

	test("releaseLease → hasLease false; pode readquirir", async () => {
		await acquireLease(db, 101);
		await releaseLease(db, 101);
		expect(await hasLease(db, 101)).toBe(false);
		const got = await acquireLease(db, 101);
		expect(got).toBe(true);
	});

	test("M1: dois acquireLease concorrentes na mesma fatura → exatamente um true", async () => {
		const [a, b] = await Promise.all([
			acquireLease(db, 200),
			acquireLease(db, 200),
		]);
		const trues = [a, b].filter(Boolean);
		expect(trues.length).toBe(1);
	});
});
