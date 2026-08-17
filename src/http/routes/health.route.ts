/**
 * Rota de health/liveness (ADR-0002): `GET /health` responde 200 se o processo
 * está de pé e o SQLite de coordenação responde a um ping. Sem readiness que
 * dependa dos provedores externos (a disponibilidade deles não tira o pod do ar).
 */
import { Hono } from "hono";

/**
 * Cria a sub-app de health. Não exige dependências externas — o liveness é
 * só "o processo está de pé". O ping do SQLite fica a cargo do composition
 * root se desejado; por ora, liveness puro.
 */
export function criarHealthRoute(): Hono {
	const app = new Hono();
	app.get("/health", (c) => c.json({ status: "ok" }, 200));
	return app;
}
