/**
 * Unit do `getDb`/`resetDbForTests` (src/lib/db/client.ts) — o singleton do DB
 * de coordenação. Mock de `#/env` com `DATABASE_URL=:memory:` (branch não-local:
 * sem mkdir, sem prefixo `file:`); o branch local (tmpdir + mkdir) já é
 * exercitado pelo boot smoke (DATABASE_URL real em tmp).
 */
import { describe, expect, it, mock } from "bun:test";

mock.module("#/env", () => ({
	env: { DATABASE_URL: ":memory:" },
}));

const { getDb, resetDbForTests } = await import("#/lib/db/client");

describe("lib/db/client — getDb (singleton, ADR-0003)", () => {
	it("retorna o mesmo DB para chamadas repetidas (singleton)", async () => {
		resetDbForTests();
		const a = getDb();
		const b = getDb();
		expect(a).toBe(b);
		// `:memory:` → não é path local: conexão sem prefixo file:/mkdir.
		// (smoke de SELECT 1: o db responde.)
		await a.run("SELECT 1");
	});

	it("resetDbForTests() descarta o singleton e recria a conexão", async () => {
		const a = getDb();
		resetDbForTests();
		const b = getDb();
		expect(b).not.toBe(a);
		await b.run("SELECT 1");
	});
});
