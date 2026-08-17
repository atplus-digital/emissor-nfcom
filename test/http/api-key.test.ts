import { describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { apiKeyMiddleware } from "#/http/middlewares/api-key";

function mkApp(key: string) {
	const app = new Hono();
	app.use("*", apiKeyMiddleware(key));
	app.get("/ok", (c) => c.json({ ok: true }));
	return app;
}

describe("apiKeyMiddleware", () => {
	it("sem header → 401 envelope NAO_AUTORIZADO", async () => {
		const app = mkApp("secret");
		const res = await app.request("/ok");
		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body.erro.tipo).toBe("NAO_AUTORIZADO");
		expect(body.erro.mensagem).toMatch(/api.?key/i);
	});

	it("header errado → 401", async () => {
		const app = mkApp("secret");
		const res = await app.request("/ok", { headers: { "X-API-Key": "wrong" } });
		expect(res.status).toBe(401);
		expect((await res.json()).erro.tipo).toBe("NAO_AUTORIZADO");
	});

	it("header correto → passa adiante (200)", async () => {
		const app = mkApp("secret");
		const res = await app.request("/ok", { headers: { "X-API-Key": "secret" } });
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true });
	});
});
