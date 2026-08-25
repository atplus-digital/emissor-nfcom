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
import {
	clienteFixture,
	fakeAtacado,
	fakeQueue,
	faturaAemitirFixture,
	parceiroFixture,
	parceiroResumoFixture,
} from "./_helpers";
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

function appData(atacado = fakeAtacado(), queue = fakeQueue()) {
	const session = criarPainelSessionMiddleware(SECRET, {
		signIn: async () => ({ token: "t" }),
		check: async () => true,
	});
	return criarPainelDataRoutes({ atacado, session, queue });
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

describe("GET /api/parceiros — lista (seletor)", () => {
	test("sem auth → 401 NAO_AUTORIZADO", async () => {
		const res = await appData().request("/api/parceiros");
		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body.erro.tipo).toBe("NAO_AUTORIZADO");
	});

	test("auth → 200 lista com cnpj mascarado (fronteira de UI)", async () => {
		const app = appData(
			fakeAtacado({
				listarParceiros: async () => [parceiroResumoFixture(), parceiroResumoFixture({ id: 7, razaoSocial: "Outro", fantasia: undefined })],
			} as any),
		);
		const res = await app.request("/api/parceiros", { headers: AUTH });
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toHaveLength(2);
		expect(body[0]).toEqual({
			id: 42,
			razaoSocial: "Parceiro Ltda",
			fantasia: "Parceiro",
			cnpj: "11.444.777/0001-61",
		});
		expect(body[1].fantasia).toBeUndefined();
	});

	test("lista vazia → 200 []", async () => {
		const res = await appData().request("/api/parceiros", { headers: AUTH });
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual([]);
	});
});

describe("GET /api/parceiros/:id — detalhe", () => {
	test("auth → 200 detalhe (cnpj mascarado, endereço, ie, diaVencimento)", async () => {
		const app = appData(
			fakeAtacado({ buscarParceiroPorId: async () => parceiroFixture() } as any),
		);
		const res = await app.request("/api/parceiros/42", { headers: AUTH });
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual({
			id: 42,
			razaoSocial: "Parceiro Ltda",
			fantasia: "Parceiro",
			cnpj: "11.444.777/0001-61",
			emailFaturamento: "fin@parceiro.com",
			diaVencimento: 10,
			ie: "123",
			endereco: {
				logradouro: "Rua Exemplo",
				numero: "123",
				bairro: "Centro",
				cep: "80000000",
				cidade: "Curitiba",
				uf: "PR",
			},
		});
	});

	test("parceiro null → 404 NAO_ENCONTRADO", async () => {
		const app = appData(fakeAtacado({ buscarParceiroPorId: async () => null } as any));
		const res = await app.request("/api/parceiros/999", { headers: AUTH });
		expect(res.status).toBe(404);
		const body = await res.json();
		expect(body.erro.tipo).toBe("NAO_ENCONTRADO");
	});

	test("id inválido (abc / 0) → 422 VALIDACAO", async () => {
		for (const id of ["abc", "0"]) {
			const res = await appData().request(`/api/parceiros/${id}`, { headers: AUTH });
			expect(res.status).toBe(422);
			const body = await res.json();
			expect(body.erro.tipo).toBe("VALIDACAO");
		}
	});

	test("sem auth → 401", async () => {
		const res = await appData().request("/api/parceiros/42");
		expect(res.status).toBe(401);
	});
});

describe("GET /api/parceiros/:id/clientes — clientes paginados", () => {
	test("auth → 200 envelope paginado com cpfcnpj mascarado e linhas em reais", async () => {
		// Fake padrão (clienteFixture: CPF_VALIDO, 1 linha a 10000 centavos).
		const app = appData();
		const res = await app.request("/api/parceiros/42/clientes", { headers: AUTH });
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.total).toBe(1);
		expect(body.page).toBe(1);
		expect(body.pageSize).toBe(20);
		expect(body.totalPaginas).toBe(1);
		expect(body.itens).toHaveLength(1);
		expect(body.itens[0].cpfcnpj).toBe("529.982.247-25");
		expect(body.itens[0].linhas).toEqual([
			{ planoId: 100, descricao: "Plano 100Mbps", unitario: 100, quantidade: 1 },
		]);
		expect(body.itens[0].endereco.cidade).toBe("Curitiba");
	});

	test("query completa → listarClientesParceiro com filtro + paginação", async () => {
		let args: any = null;
		const app = appData(
			fakeAtacado({
				listarClientesParceiro: async (...a: any[]) => {
					args = a;
					return { itens: [], total: 0 };
				},
			} as any),
		);
		const res = await app.request(
			"/api/parceiros/42/clientes?page=3&pageSize=7&busca=joão&cpfcnpj=52998224725&cidade=Curitiba&uf=pr",
			{ headers: AUTH },
		);
		expect(res.status).toBe(200);
		expect(args).toEqual([
			42,
			{ busca: "joão", cpfcnpj: "52998224725", cidade: "Curitiba", uf: "pr" },
			{ page: 3, pageSize: 7 },
		]);
	});

	test("total > 1 página → totalPaginas arredonda p/ cima", async () => {
		const app = appData(
			fakeAtacado({
				listarClientesParceiro: async () => ({ itens: [], total: 41 }),
			} as any),
		);
		const res = await app.request("/api/parceiros/42/clientes?page=3&pageSize=20", { headers: AUTH });
		const body = await res.json();
		expect(body.totalPaginas).toBe(3);
		expect(body.page).toBe(3);
	});

	test("parceiro sem clientes → 200 envelope vazio (itens [], total 0)", async () => {
		const app = appData(
			fakeAtacado({
				listarClientesParceiro: async () => ({ itens: [], total: 0 }),
			} as any),
		);
		const res = await app.request("/api/parceiros/42/clientes", { headers: AUTH });
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			itens: [],
			total: 0,
			page: 1,
			pageSize: 20,
			totalPaginas: 1,
		});
	});

	test("query inválida (page=0 / pageSize=1000 / uf=x) → 422 VALIDACAO", async () => {
		for (const qs of ["page=0", "pageSize=1000", "uf=x", "busca="]) {
			const res = await appData().request(`/api/parceiros/42/clientes?${qs}`, {
				headers: AUTH,
			});
			expect(res.status).toBe(422);
			const body = await res.json();
			expect(body.erro.tipo).toBe("VALIDACAO");
		}
	});

	test("id inválido → 422; sem auth → 401", async () => {
		expect((await appData().request("/api/parceiros/abc/clientes", { headers: AUTH })).status).toBe(422);
		expect((await appData().request("/api/parceiros/42/clientes")).status).toBe(401);
	});
});

describe("POST /api/faturas/preparar — emissão (mesmo handler da API key)", () => {
	const body = { parceiroId: 42, dataReferencia: "2026-08-01", tipoFaturamento: "parceiro" };

	test("sem auth → 401 NAO_AUTORIZADO", async () => {
		const res = await appData().request("/api/faturas/preparar", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body),
		});
		expect(res.status).toBe(401);
		const b = await res.json();
		expect(b.erro.tipo).toBe("NAO_AUTORIZADO");
	});

	test("body inválido → 422 VALIDACAO com flatten", async () => {
		const res = await appData().request("/api/faturas/preparar", {
			method: "POST",
			headers: { "content-type": "application/json", ...AUTH },
			body: JSON.stringify({ parceiroId: "x", dataReferencia: "01/08/2026", tipoFaturamento: "outro" }),
		});
		expect(res.status).toBe(422);
		const b = await res.json();
		expect(b.erro.tipo).toBe("VALIDACAO");
		expect(b.erro.detalhe.fieldErrors).toBeDefined();
	});

	test("criação feliz → 201 com árvore em reais e docs mascarados", async () => {
		// fakeAtacado padrão: parceiro (IE "123") + cliente + plano válidos;
		// ids de criação 101/456/7.
		const app = appData();
		const res = await app.request("/api/faturas/preparar", {
			method: "POST",
			headers: { "content-type": "application/json", ...AUTH },
			body: JSON.stringify(body),
		});
		expect(res.status).toBe(201);
		const b = await res.json();
		expect(b.faturaId).toBe(101);
		expect(b.status).toBe("a-emitir");
		expect(b.valorTotal).toBe(100); // 10000 centavos → 100,00
		expect(b.cobrancas).toHaveLength(1);
		const cb = b.cobrancas[0];
		expect(cb.id).toBe(456);
		expect(cb.valorTotal).toBe(100); // centavos → reais
		expect(cb.documentoDevedor).toBe("11.444.777/0001-61"); // CNPJ mascarado
		expect(cb.dataVencimento).toBe("2026-09-10");
		expect(cb.descricao).toBe("1x Plano 100Mbps = R$ 100,00\nAgo/2026");
		expect(cb.notas).toHaveLength(1);
		expect(cb.notas[0]).toMatchObject({
			id: 7,
			// tipo `parceiro` → destinatário da nota é o próprio parceiro (CNPJ).
			cpfcnpj: "11.444.777/0001-61", // CNPJ mascarado
			total: 100, // centavos → reais
			cobrancaId: 456,
			status: "a-emitir",
		});
		// Itens com valores convertidos p/ reais (fronteira de UI, ADR-0004).
		expect(cb.notas[0].itens).toEqual([
			{
				item: undefined,
				codigo: undefined,
				descricao: "Plano 100Mbps",
				cfop: "6307",
				cclass: "0100201",
				quantidade: 1,
				unitario: 100,
				total: 100,
				aliqIcms: 0,
				bcIcms: 100,
				icms: 0,
				incideAliquota: false,
			},
		]);
	});

	test("parceiro inexistente (handler) → 422 VALIDACAO", async () => {
		const app = appData(
			fakeAtacado({ buscarParceiroPorId: async () => null } as any),
		);
		const res = await app.request("/api/faturas/preparar", {
			method: "POST",
			headers: { "content-type": "application/json", ...AUTH },
			body: JSON.stringify(body),
		});
		expect(res.status).toBe(422);
		const b = await res.json();
		expect(b.erro.tipo).toBe("VALIDACAO");
	});
});

describe("POST /api/faturas/:id/emitir — emissão (helper compartilhado)", () => {
	test("sem auth → 401 NAO_AUTORIZADO", async () => {
		const res = await appData().request("/api/faturas/101/emitir", { method: "POST" });
		expect(res.status).toBe(401);
		const b = await res.json();
		expect(b.erro.tipo).toBe("NAO_AUTORIZADO");
	});

	test("id inválido (abc / 0) → 422 VALIDACAO", async () => {
		for (const id of ["abc", "0"]) {
			const res = await appData().request(`/api/faturas/${id}/emitir`, {
				method: "POST",
				headers: AUTH,
			});
			expect(res.status).toBe(422);
			const b = await res.json();
			expect(b.erro.tipo).toBe("VALIDACAO");
		}
	});

	test("sucesso → 202 { jobId, statusUrl } e enfileira na QueuePort", async () => {
		const f = faturaAemitirFixture();
		const queue = fakeQueue();
		const app = appData(
			fakeAtacado({ getFaturaPorId: async () => f } as any),
			queue,
		);
		const res = await app.request("/api/faturas/101/emitir", {
			method: "POST",
			headers: AUTH,
		});
		expect(res.status).toBe(202);
		expect(await res.json()).toEqual({ jobId: "job-1", statusUrl: "/faturas/101/emissao" });
		expect(queue.calls).toEqual([{ faturaId: 101 }]);
	});

	test("fatura inexistente → 404 NAO_ENCONTRADO", async () => {
		const app = appData(fakeAtacado({ getFaturaPorId: async () => null } as any));
		const res = await app.request("/api/faturas/999/emitir", {
			method: "POST",
			headers: AUTH,
		});
		expect(res.status).toBe(404);
		const b = await res.json();
		expect(b.erro.tipo).toBe("NAO_ENCONTRADO");
	});

	test("fatura emitindo → 409 CONFLITO", async () => {
		const app = appData(
			fakeAtacado({ getFaturaPorId: async () => faturaAemitirFixture({ status: "emitindo" }) } as any),
		);
		const res = await app.request("/api/faturas/101/emitir", {
			method: "POST",
			headers: AUTH,
		});
		expect(res.status).toBe(409);
		const b = await res.json();
		expect(b.erro.tipo).toBe("CONFLITO");
	});
});
