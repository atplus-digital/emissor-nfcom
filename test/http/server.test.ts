import { describe, expect, mock, it } from "bun:test";
import { Hono } from "hono";
import { criarApp } from "#/http/server";
import { requestLogMiddleware } from "#/http/middlewares/request-log";
import { errorHandler } from "#/http/middlewares/error-handler";
import type { AtacadoPort, QueuePort } from "#/domain/ports";

const fakeAtacado = {} as AtacadoPort;
const fakeQueue = {
	enfileirarEmissaoFatura: mock(() => Promise.resolve({ jobId: "j1" })),
	enfileirarWebhook: mock(() => Promise.resolve()),
} as unknown as QueuePort;

describe("criarApp (composition)", () => {
	it("GET /health responde 200 sem auth", async () => {
		const app = criarApp({ atacado: fakeAtacado, queue: fakeQueue, apiKey: "k" });
		const res = await app.request("/health");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.status).toBe("ok");
	});

	it("POST /faturas/preparar sem X-API-Key → 401", async () => {
		const app = criarApp({ atacado: fakeAtacado, queue: fakeQueue, apiKey: "secret" });
		const res = await app.request("/faturas/preparar", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ parceiroId: 1, dataReferencia: "2026-08-01", tipoFaturamento: "parceiro" }),
		});
		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body.erro.tipo).toBe("NAO_AUTORIZADO");
	});

	it("POST /faturas/preparar com api key errada → 401", async () => {
		const app = criarApp({ atacado: fakeAtacado, queue: fakeQueue, apiKey: "secret" });
		const res = await app.request("/faturas/preparar", {
			method: "POST",
			headers: { "content-type": "application/json", "x-api-key": "wrong" },
			body: JSON.stringify({ parceiroId: 1, dataReferencia: "2026-08-01", tipoFaturamento: "parceiro" }),
		});
		expect(res.status).toBe(401);
	});

	it("POST /faturas/preparar com body inválido → 422 VALIDACAO (handler canônico, não 500)", async () => {
		const app = criarApp({ atacado: fakeAtacado, queue: fakeQueue, apiKey: "secret" });
		// Body faltando campos obrigatórios → Zod invalida.
		const res = await app.request("/faturas/preparar", {
			method: "POST",
			headers: { "content-type": "application/json", "x-api-key": "secret" },
			body: JSON.stringify({ parceiroId: "não-numérico" }),
		});
		expect(res.status).toBe(422);
		const body = await res.json();
		expect(body.erro.tipo).toBe("VALIDACAO");
	});

	it("logLevel debug liga o detalhe de ERRO_INTERNO na resposta", async () => {
		const app = new Hono();
		app.use("*", requestLogMiddleware());
		app.onError(errorHandler({ debug: true }));
		// Rota protegida — sem api key deve 401 antes de qualquer erro interno;
		// o handler é o canônico e o debug entra pelo error-handler (default off).
		app.get("*", () => {
			throw new Error("boom-rota");
		});
		const res = await app.request("/x");
		expect(res.status).toBe(500);
		const body = await res.json();
		expect(body.erro.tipo).toBe("ERRO_INTERNO");
		expect(body.erro.detalhe.mensagem).toBe("boom-rota");
		expect(typeof body.erro.detalhe.stack).toBe("string");
	});
});
