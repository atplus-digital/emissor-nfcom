import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { sql } from "drizzle-orm";
import { rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "#/lib/db/schema";
import {
	acquireKey,
	resolveKey,
	getKey,
} from "#/lib/db/idempotency";
import {
	enqueueOutbox,
	drainOutbox,
	markOutboxDone,
	incOutboxAttempts,
} from "#/lib/db/outbox";
import { acquireLease, releaseLease, hasLease } from "#/lib/db/lease";

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
	test("acquireKey em key nova → in_progress, sem external_id", async () => {
		const r = await acquireKey(db, "cobranca:42:boleto", "asaas.boleto");
		expect(r.status).toBe("in_progress");
		expect(r.externalId).toBeNull();
	});

	test("acquireKey na mesma key novamente → in_progress, não resolve", async () => {
		await acquireKey(db, "cobranca:42:boleto", "asaas.boleto");
		const r = await acquireKey(db, "cobranca:42:boleto", "asaas.boleto");
		expect(r.status).toBe("in_progress");
		expect(r.externalId).toBeNull();
	});

	test("resolveKey → status resolved + external_id persistido", async () => {
		await acquireKey(db, "cobranca:42:boleto", "asaas.boleto");
		await resolveKey(db, "cobranca:42:boleto", "pay_abc123");
		const k = await getKey(db, "cobranca:42:boleto");
		expect(k?.status).toBe("resolved");
		expect(k?.externalId).toBe("pay_abc123");
	});

	test("acquireKey em key já resolvida → retorna external_id (caminho de reuso)", async () => {
		await acquireKey(db, "cobranca:42:boleto", "asaas.boleto");
		await resolveKey(db, "cobranca:42:boleto", "pay_abc123");
		const r = await acquireKey(db, "cobranca:42:boleto", "asaas.boleto");
		expect(r.status).toBe("resolved");
		expect(r.externalId).toBe("pay_abc123");
	});

	test("getKey em key inexistente → null", async () => {
		const k = await getKey(db, "inexistente");
		expect(k).toBeNull();
	});
});

describe("outbox: enqueue / drain / markDone / incAttempts", () => {
	test("enqueueOutbox insere pending", async () => {
		await enqueueOutbox(db, {
			aggregate: "fatura",
			aggregateId: 1,
			payload: { foo: "bar" },
		});
		const pending = await drainOutbox(db, 10);
		expect(pending.length).toBe(1);
		expect(pending[0].aggregate).toBe("fatura");
		expect(pending[0].status).toBe("pending");
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

	test("incOutboxAttempts incrementa o contador", async () => {
		await enqueueOutbox(db, { aggregate: "fatura", aggregateId: 1, payload: {} });
		const pending = await drainOutbox(db, 10);
		await incOutboxAttempts(db, pending[0].id);
		const again = await drainOutbox(db, 10);
		expect(again[0].attempts).toBe(1);
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
});
