/**
 * Migração do SQLite de coordenação (Drizzle — ADR/0003).
 * Executa as migrations de ./drizzle contra DATABASE_URL.
 * Idempotente: seguro rodar a cada boot (usado no CMD do Dockerfile).
 */
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { db } from "../src/db/client";

async function main() {
	const databaseUrl = process.env.DATABASE_URL ?? "./data/emissor.db";
	const dir = dirname(databaseUrl);
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}

	await migrate(db, { migrationsFolder: "./drizzle" });
	console.log(`migrations aplicadas em ${databaseUrl}`);
}

main().catch((error) => {
	console.error("falha ao migrar:", error);
	process.exit(1);
});
