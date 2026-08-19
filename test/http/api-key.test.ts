import { describe, expect, it, mock } from "bun:test";
import { Hono } from "hono";

// Mock do env ANTES do import dinâmico do middleware (o factory
// `criarApiKeyMiddleware` importa `#/env` lazily — o mock evita a validação
// real de env; mesmo padrão do test/integration/flow.test.ts).
mock.module("#/env", () => ({
	env: { EMISSOR_API_KEY: "env-key" },
}));

const { apiKeyMiddleware, criarApiKeyMiddleware } = await import("#/http/middlewares/api-key");

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

describe("criarApiKeyMiddleware (factory do composition root)", () => {
	it("lê env.EMISSOR_API_KEY e devolve o middleware funcional", async () => {
		const app = new Hono();
		app.use("*", await criarApiKeyMiddleware());
		app.get("/ok", (c) => c.json({ ok: true }));
		// a env mockada expõe "env-key"
		const res = await app.request("/ok", { headers: { "X-API-Key": "env-key" } });
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true });
	});
});
