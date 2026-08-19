/**
 * Helper de teste: cria um DB SQLite de coordenação efêmero (arquivo temp único)
 * e aplica as migrations geradas (drizzle/). Cada teste ganha um DB limpo.
 */
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "@emissor/db/schema";

export type TestDB = LibSQLDatabase<typeof schema>;

/**
 * Cria o DB e APLICA as migrations (drizzle migrator é async — precisa do await,
 * senão a 1ª query corre antes das CREATE TABLE completarem). Retorna o DB
 * pronto p/ uso.
 */
export async function mkDb(): Promise<TestDB> {
	const dir = join(
		tmpdir(),
		`emissor-test-${Math.random().toString(36).slice(2)}`,
	);
	mkdirSync(dir, { recursive: true });
	const file = join(dir, "coord.db");
	const db = drizzle({ connection: `file:${file}`, schema });
	await migrate(db, { migrationsFolder: "./drizzle" });
	return db;
}
