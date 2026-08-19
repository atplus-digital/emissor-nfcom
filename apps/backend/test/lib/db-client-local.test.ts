/**
 * Unit do branch LOCAL de `getDb` (packages/db/src/client.ts): quando `DATABASE_URL`
 * é um path de arquivo local cujo diretório-pai NÃO existe, `getDb` cria o
 * diretório (`mkdirSync(dir, { recursive: true })`) antes de abrir a conexão.
 *
 * Arquivo separado de `db-client.test.ts` porque o `DATABASE_URL` é lido do
 * process.env no import (--isolate, um processo por arquivo): aqui definimos
 * um path aninhado em tmp (subdir inexistente) para exercitar o branch de
 * mkdir; o outro arquivo usa `:memory:` (branch não-local).
 */
import { describe, expect, it } from "bun:test";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Path aninhado: o subdir `sub` NÃO existe — o mkdir recursivo deve criá-lo.
const ROOT = join(tmpdir(), `emissor-dbclient-${Date.now()}-${Math.random().toString(36).slice(2)}`);
const DATABASE_URL = join(ROOT, "sub", "coord.db");

// O client lê process.env direto (pacote de workspace, ADR-0011).
process.env.DATABASE_URL = DATABASE_URL;

const { getDb, resetDbForTests } = await import("@emissor/db/client");

describe("lib/db/client — getDb com DATABASE_URL local (mkdir do diretório-pai)", () => {
	it("cria o diretório-pai inexistente e abre a conexão (SELECT 1)", async () => {
		resetDbForTests();
		// Antes: o diretório-pai não existe.
		expect(existsSync(join(ROOT, "sub"))).toBe(false);

		const db = getDb();
		// O mkdir recursivo criou o subdir.
		expect(existsSync(join(ROOT, "sub"))).toBe(true);
		// A conexão responde.
		await db.run("SELECT 1");
	});

	it("resetDbForTests() descarta o singleton e recria a conexão no mesmo path", async () => {
		const a = getDb();
		resetDbForTests();
		const b = getDb();
		expect(b).not.toBe(a);
		await b.run("SELECT 1");
	});
});
