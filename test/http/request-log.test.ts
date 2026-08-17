import { describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { requestLogMiddleware } from "#/http/middlewares/request-log";
import { getLogContext } from "#/lib/logger";

function mkApp() {
	const app = new Hono();
	app.use("*", requestLogMiddleware());
	app.get("/ok", (c) => c.json({ ctx: getLogContext() }));
	app.post("/outro", (c) => c.json({ ctx: getLogContext() }));
	return app;
}

describe("requestLogMiddleware", () => {
	it("popula o ALS com metodo e rota no handler downstream", async () => {
		const app = mkApp();
		const res = await app.request("/ok", { method: "GET" });
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.ctx).toEqual({ metodo: "GET", rota: "/ok" });
	});

	it("diferencia rota e metodo entre requests", async () => {
		const app = mkApp();
		const r1 = await (await app.request("/ok", { method: "GET" })).json();
		const r2 = await (await app.request("/outro", { method: "POST" })).json();
		expect(r1.ctx.rota).toBe("/ok");
		expect(r1.ctx.metodo).toBe("GET");
		expect(r2.ctx.rota).toBe("/outro");
		expect(r2.ctx.metodo).toBe("POST");
	});
});
