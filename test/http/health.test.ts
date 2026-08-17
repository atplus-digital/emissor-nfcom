import { describe, expect, test } from "bun:test";
import { criarHealthRoute } from "#/http/routes/health.route";

describe("GET /health", () => {
	test("responde 200 {status: ok} (liveness, ADR-0002)", async () => {
		const app = criarHealthRoute();
		const res = await app.request("/health");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual({ status: "ok" });
	});
});
