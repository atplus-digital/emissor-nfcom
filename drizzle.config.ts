import { defineConfig } from "drizzle-kit";

/**
 * Config do drizzle-kit (tooling — fora do app; exceção de `process.env` direto,
 * AGENTS.md). O schema de coordenação vive em `src/lib/db/schema.ts` (ADR-0007);
 * migrations geradas em `drizzle/` (ADR-0003).
 *
 * Uso:
 *   bunx drizzle-kit generate   # ao mudar src/lib/db/schema.ts
 *   bunx drizzle-kit migrate    # aplica (roda no boot do pod, CMD do Dockerfile)
 */
export default defineConfig({
	dialect: "sqlite",
	schema: "./src/lib/db/schema.ts",
	out: "./drizzle",
	dbCredentials: {
		url: process.env.DATABASE_URL ?? "./data/emissor.db",
	},
});
