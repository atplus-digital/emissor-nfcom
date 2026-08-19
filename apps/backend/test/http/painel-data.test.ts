/**
 * Rotas de dados do painel — `src/http/routes/painel-data.route.ts`.
 *
 * - Toda rota de dados exige sessão (middleware `app.use("*", session.middleware)`):
 *   sem cookie → 401 NAO_AUTORIZADO.
 * - `GET /api/faturas`: query opcional (parceiroId/dataReferencia/status) →
 *   `atacado.listarFaturas(filtro)`; query inválida → 422 VALIDACAO;
 *   200 = lista serializada (centavos → reais).
 * - `GET /api/faturas/:id`: id inválido → 422; fatura null → 404; 200 detalhe.
 * - `GET /api/faturas/:id/emissao`: 200 estado + erros resolvidos pelos ids da
 *   árvore (mesma regra de `emissao-query.test.ts`).
 *
 * `fakeAtacado` com `listarFaturas`/`getFaturaPorId`/`buscarErrosPorFatura`
 * sobrescritos; session middleware real com secret de teste.
 */
import { createHmac } from "node:crypto";
import { describe, expect, test } from "bun:test";
import { criarPainelDataRoutes } from "#/http/routes/painel-data.route";
import {
	criarPainelSessionMiddleware,
	PAINEL_COOKIE,
} from "#/http/middlewares/painel-session";
import { fakeAtacado, faturaAemitirFixture } from "./_helpers";
import type { FaturaResumo } from "#/domain/ports/atacado.port";

const SECRET = "segredo-de-teste-painel-data";

/** Cookie de sessão válido (assinado com o secret do teste). */
function cookieValido(over: Record<string, unknown> = {}): string {
	const payload = { token: "tok-1", userId: 7, nickname: "bob", exp: Date.now() + 60_000, ...over };
	const b64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
	const sig = createHmac("sha256", SECRET).update(b64).digest("hex");
	return `${PAINEL_COOKIE}=${b64}.${sig}`;
}

const AUTH = { cookie: cookieValido() } as Record<string, string>;

const resumo: FaturaResumo = {
	id: 101,
	parceiroId: 42,
	dataReferencia: "2026-08-01",
	dataVencimento: "2026-09-10",
	valorTotal: 10000,
	tipoFaturamento: "parceiro",
	status: "a-emitir",
	cobrancasCount: 1,
};

function appData(atacado = fakeAtacado()) {
	const session = criarPainelSessionMiddleware(SECRET, {
		signIn: async () => ({ token: "t" }),
		check: async () => true,
	});
	return criarPainelDataRoutes({ atacado, session });
}

describe("GET /api/faturas — autenticação", () => {
	test("sem cookie (sem auth) → 401 NAO_AUTORIZADO", async () => {
		const res = await appData().request("/api/faturas");
		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body.erro.tipo).toBe("NAO_AUTORIZADO");
	});

	test("cookie expirado → 401", async () => {
		const res = await appData().request("/api/faturas", {
			headers: { cookie: cookieValido({ exp: Date.now() - 1000 }) },
		});
		expect(res.status).toBe(401);
	});
});

describe("GET /api/faturas — listagem", () => {
	test("auth + sem filtros → 200 lista serializada (centavos → reais)", async () => {
		const app = appData(
			fakeAtacado({ listarFaturas: async () => [resumo] } as any),
		);
		const res = await app.request("/api/faturas", { headers: AUTH });
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toHaveLength(1);
		expect(body[0].valorTotal).toBe(100);
		expect(body[0].cobrancasCount).toBe(1);
		expect(body[0].status).toBe("a-emitir");
	});

	test("query completa → listarFaturas chamado com o filtro inteiro", async () => {
		let filtro: any = null;
		const app = appData(
			fakeAtacado({
				listarFaturas: async (f: any) => {
					filtro = f;
					return [resumo];
				},
			} as any),
		);
		const res = await app.request(
			"/api/faturas?parceiroId=42&dataReferencia=2026-08-01&status=a-emitir",
			{ headers: AUTH },
		);
		expect(res.status).toBe(200);
		expect(filtro).toEqual({
			parceiroId: 42,
			dataReferencia: "2026-08-01",
			status: "a-emitir",
		});
	});

	test("query parcial → só os campos presentes", async () => {
		let filtro: any = null;
		const app = appData(
			fakeAtacado({
				listarFaturas: async (f: any) => {
					filtro = f;
					return [];
				},
			} as any),
		);
		await app.request("/api/faturas?status=erro", { headers: AUTH });
		expect(filtro).toEqual({ status: "erro" });
	});

	test("status fora do enum → 422 VALIDACAO", async () => {
		const res = await appData().request("/api/faturas?status=invalido", {
			headers: AUTH,
		});
		expect(res.status).toBe(422);
		const body = await res.json();
		expect(body.erro.tipo).toBe("VALIDACAO");
	});

	test("dataReferencia mal formatada → 422 VALIDACAO", async () => {
		const res = await appData().request("/api/faturas?dataReferencia=01/08/2026", {
			headers: AUTH,
		});
		expect(res.status).toBe(422);
		const body = await res.json();
		expect(body.erro.tipo).toBe("VALIDACAO");
	});

	test("parceiroId não numérico → 422 VALIDACAO", async () => {
		const res = await appData().request("/api/faturas?parceiroId=abc", {
			headers: AUTH,
		});
		expect(res.status).toBe(422);
	});
});

describe("GET /api/faturas/:id — detalhe", () => {
	test("fatura null → 404 NAO_ENCONTRADO", async () => {
		const app = appData(fakeAtacado({ getFaturaPorId: async () => null } as any));
		const res = await app.request("/api/faturas/999", { headers: AUTH });
		expect(res.status).toBe(404);
		const body = await res.json();
		expect(body.erro.tipo).toBe("NAO_ENCONTRADO");
	});

	test("id inválido (abc / 0) → 422 VALIDACAO", async () => {
		for (const id of ["abc", "0"]) {
			const res = await appData().request(`/api/faturas/${id}`, { headers: AUTH });
			expect(res.status).toBe(422);
			const body = await res.json();
			expect(body.erro.tipo).toBe("VALIDACAO");
		}
	});

	test("fatura existe → 200 detalhe serializado (reais + docs mascarados)", async () => {
		const f = faturaAemitirFixture();
		const app = appData(fakeAtacado({ getFaturaPorId: async () => f } as any));
		const res = await app.request("/api/faturas/101", { headers: AUTH });
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.id).toBe(101);
		expect(body.valorTotal).toBe(100);
		expect(body.cobrancas[0].documentoDevedor).toBe("11.444.777/0001-61");
		expect(body.cobrancas[0].notas[0].cpfcnpj).toBe("529.982.247-25");
	});
});

describe("GET /api/faturas/:id/emissao — estado + erros", () => {
	test("200 com erros resolvidos pelos ids de cobrança/nota da árvore", async () => {
		const f = faturaAemitirFixture({ status: "erro" });
		f.cobrancas[0].id = 456;
		f.cobrancas[0].notas[0].id = 7;
		const chamada: { cobrancaIds: number[]; notaIds: number[] } = {
			cobrancaIds: [],
			notaIds: [],
		};
		const app = appData(
			fakeAtacado({
				getFaturaPorId: async () => f,
				buscarErrosPorFatura: async (cobrancaIds, notaIds) => {
					chamada.cobrancaIds = cobrancaIds;
					chamada.notaIds = notaIds;
					return [
						{ id: 1, cobrancaId: 456, erro: "BOLETO", mensagem: "customer inválido" },
						{ id: 2, notaId: 7, erro: "NFCOM", mensagem: "Duplicidade", statusCode: "500" },
					];
				},
			} as any),
		);
		const res = await app.request("/api/faturas/101/emissao", { headers: AUTH });
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.faturaId).toBe(101);
		expect(body.status).toBe("erro");
		expect(body.erros).toHaveLength(2);
		expect(body.erros[1]).toEqual({
			id: 2,
			cobrancaId: undefined,
			notaId: 7,
			erro: "NFCOM",
			mensagem: "Duplicidade",
			statusCode: "500",
		});
		// ids resolvidos da árvore (t_nfcom_erros não tem FK de fatura).
		expect(chamada.cobrancaIds).toEqual([456]);
		expect(chamada.notaIds).toEqual([7]);
	});

	test("fatura não encontrada → 404", async () => {
		const app = appData(fakeAtacado({ getFaturaPorId: async () => null } as any));
		const res = await app.request("/api/faturas/999/emissao", { headers: AUTH });
		expect(res.status).toBe(404);
	});

	test("sem auth → 401", async () => {
		const res = await appData().request("/api/faturas/101/emissao");
		expect(res.status).toBe(401);
	});
});
