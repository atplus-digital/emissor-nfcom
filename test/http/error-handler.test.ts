import { describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { z } from "zod";
import { HttpError, TipoErro } from "#/http/middlewares/envelope";
import { errorHandler } from "#/http/middlewares/error-handler";

function mkApp(handler: (c: import("hono").Context) => Response | Promise<Response>) {
	const app = new Hono();
	app.get("*", (c) => handler(c));
	app.onError(errorHandler());
	return app;
}

describe("errorHandler", () => {
	it("HttpError CONFLITO → 409 envelope", async () => {
		const app = mkApp(() => {
			throw new HttpError(TipoErro.CONFLITO, "emissão em curso");
		});
		const res = await app.request("/x");
		expect(res.status).toBe(409);
		expect(await res.json()).toEqual({ erro: { tipo: "CONFLITO", mensagem: "emissão em curso", detalhe: {} } });
	});

	it("HttpError NAO_ENCONTRADO → 404", async () => {
		const app = mkApp(() => {
			throw new HttpError(TipoErro.NAO_ENCONTRADO, "fatura inexistente", { faturaId: 9 });
		});
		const res = await app.request("/x");
		expect(res.status).toBe(404);
		const body = await res.json();
		expect(body.erro.tipo).toBe("NAO_ENCONTRADO");
		expect(body.erro.detalhe).toEqual({ faturaId: 9 });
	});

	it("ZodError → 422 VALIDACAO com detalhe de campos", async () => {
		const schema = z.object({ parceiroId: z.number().positive() });
		const app = mkApp(() => {
			schema.parse({ parceiroId: -1 });
			return new Response("ok");
		});
		const res = await app.request("/x");
		expect(res.status).toBe(422);
		const body = await res.json();
		expect(body.erro.tipo).toBe("VALIDACAO");
		expect(Array.isArray(body.erro.detalhe.campos)).toBe(true);
		expect(body.erro.detalhe.campos.length).toBeGreaterThan(0);
	});

	it("Error genérico → 500 ERRO_INTERNO (sem vazar stack)", async () => {
		const app = mkApp(() => {
			throw new Error("boom interno");
		});
		const res = await app.request("/x");
		expect(res.status).toBe(500);
		const body = await res.json();
		expect(body.erro.tipo).toBe("ERRO_INTERNO");
		// mensagem genérica, não vaza detalhe interno
		expect(body.erro.mensagem).not.toContain("boom interno");
	});

	it("Logger debug → 500 ERRO_INTERNO detalha mensagem + stack no envelope", async () => {
		const app = new Hono();
		app.get("*", () => {
			throw new Error("boom interno");
		});
		app.onError(errorHandler({ debug: true }));
		const res = await app.request("/x");
		expect(res.status).toBe(500);
		const body = await res.json();
		expect(body.erro.tipo).toBe("ERRO_INTERNO");
		// Com debug, o detalhe do ERRO_INTERNO carrega a mensagem original + stack.
		expect(body.erro.detalhe.mensagem).toBe("boom interno");
		expect(typeof body.erro.detalhe.stack).toBe("string");
		expect(body.erro.detalhe.stack.length).toBeGreaterThan(0);
	});

	it("Logger debug (default off) não muda o envelope de HttpError", async () => {
		const app = new Hono();
		app.get("*", () => {
			throw new HttpError(TipoErro.CONFLITO, "emissão em curso", { faturaId: 1 });
		});
		app.onError(errorHandler({ debug: true }));
		const res = await app.request("/x");
		expect(res.status).toBe(409);
		// HttpError mantém o detalhe que carrega; debug não injeta stack extra.
		const body = await res.json();
		expect(body.erro.detalhe).toEqual({ faturaId: 1 });
	});

	it("loga o erro UMA vez com tipo + status", async () => {
		const logged: object[] = [];
		const app = mkApp(() => {
			throw new HttpError(TipoErro.CONFLITO, "x");
		});
		// errorHandler aceita logger injetável para captura
		app.onError(errorHandler({ logger: (obj) => logged.push(obj) }));
		await app.request("/x");
		expect(logged.length).toBe(1);
		expect(logged[0]).toMatchObject({ tipo: "CONFLITO", status: 409 });
	});
});
