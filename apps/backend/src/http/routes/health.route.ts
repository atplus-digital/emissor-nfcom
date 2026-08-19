/**
 * Rota de health/liveness (ADR-0002): `GET /health` responde 200 se o processo
 * está de pé E o SQLite de coordenação responde a um ping (`SELECT 1`). Sem
 * readiness que dependa dos provedores externos (a disponibilidade deles não
 * tira o pod do ar).
 */
import { sql } from "drizzle-orm";
import { Hono } from "hono";
import type { CoordDB } from "@emissor/db/client";

/**
 * Cria a sub-app de health. `pingDb` é a função que verifica o SQLite de
 * coordenação (injetada pelo composition root com `getDb()`); em teste, um fake
 * que resolve true/false. Falha do DB → 503 (o pod está de pé, mas sem o estado
 * de coordenação não serve requisições de emissão).
 */
export function criarHealthRoute(pingDb?: () => Promise<boolean>): Hono {
	const app = new Hono();
	app.get("/health", async (c) => {
		try {
			if (pingDb && !(await pingDb())) {
				return c.json({ status: "degraded", db: "unavailable" }, 503);
			}
			return c.json({ status: "ok" }, 200);
		} catch {
			return c.json({ status: "degraded", db: "unavailable" }, 503);
		}
	});
	return app;
}

/**
 * Ping do SQLite de coordenação: executa `SELECT 1` e devolve true se respondeu.
 * `false`/throw → DB indisponível (health 503).
 */
export function pingSqlite(db: CoordDB): () => Promise<boolean> {
	return async () => {
		try {
			// Mesmo idiom dos helpers de lib/db (incOutboxAttempts, etc.).
			await db.run(sql`SELECT 1`);
			return true;
		} catch {
			return false;
		}
	};
}
