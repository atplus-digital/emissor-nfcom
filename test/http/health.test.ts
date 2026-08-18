import { describe, expect, test } from "bun:test";
import { criarHealthRoute } from "#/http/routes/health.route";

describe("GET /health", () => {
	test("responde 200 {status: ok} quando não há ping de DB (liveness puro, ADR-0002)", async () => {
		const app = criarHealthRoute();
		const res = await app.request("/health");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual({ status: "ok" });
	});

	test("responde 200 {status: ok} quando o ping do SQLite responde (ADR-0002)", async () => {
		const app = criarHealthRoute(async () => true);
		const res = await app.request("/health");
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ status: "ok" });
	});

	test("responde 503 {status: degraded} quando o SQLite não responde (ADR-0002)", async () => {
		const app = criarHealthRoute(async () => false);
		const res = await app.request("/health");
		expect(res.status).toBe(503);
		expect(await res.json()).toEqual({ status: "degraded", db: "unavailable" });
	});

	test("responde 503 quando o ping lança exceção (DB quebrado, ADR-0002)", async () => {
		const app = criarHealthRoute(async () => {
			throw new Error("db down");
		});
		const res = await app.request("/health");
		expect(res.status).toBe(503);
		expect(await res.json()).toEqual({ status: "degraded", db: "unavailable" });
	});
});
