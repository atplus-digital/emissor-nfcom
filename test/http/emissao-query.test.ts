import { describe, expect, test } from "bun:test";
import { criarFaturasRoutes } from "#/http/routes/faturas.route";
import { fakeAtacado, fakeQueue, faturaAemitirFixture } from "./_helpers";

/** GET /faturas/:id/emissao (SPEC-0001 passo 7) — estado atual; 404 se não existe. */
describe("GET /faturas/:id/emissao", () => {
	test("retorna estado da fatura com cobranças/notas", async () => {
		const f = faturaAemitirFixture({ status: "emitindo" });
		f.cobrancas[0].id = 456;
		f.cobrancas[0].notas[0].id = 7;
		f.cobrancas[0].notas[0].situacao = "processando";
		f.cobrancas[0].linkFatura = "http://boleto";
		const app = criarFaturasRoutes({
			atacado: fakeAtacado({ getFaturaPorId: async () => f } as any),
			queue: fakeQueue(),
		});
		const res = await app.request("/faturas/101/emissao");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.faturaId).toBe(101);
		expect(body.status).toBe("emitindo");
		expect(body.cobrancas[0].boletoUrl).toBe("http://boleto");
		expect(body.cobrancas[0].notas[0].situacao).toBe("processando");
	});

	test("retorna erros de emissão (t_nfcom_erros) resolvidos pelos ids de cobrança/nota", async () => {
		const f = faturaAemitirFixture({ status: "erro" });
		f.cobrancas[0].id = 456;
		f.cobrancas[0].notas[0].id = 7;
		const chamada: { cobrancaIds: number[]; notaIds: number[] } = { cobrancaIds: [], notaIds: [] };
		const app = criarFaturasRoutes({
			atacado: fakeAtacado({
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
			queue: fakeQueue(),
		});
		const res = await app.request("/faturas/101/emissao");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.erros).toHaveLength(2);
		expect(body.erros[0]).toEqual({ id: 1, cobrancaId: 456, notaId: undefined, erro: "BOLETO", mensagem: "customer inválido", statusCode: undefined });
		expect(body.erros[1]).toEqual({ id: 2, cobrancaId: undefined, notaId: 7, erro: "NFCOM", mensagem: "Duplicidade", statusCode: "500" });
		// ids resolvidos da árvore da fatura (t_nfcom_erros não tem FK de fatura)
		expect(chamada.cobrancaIds).toEqual([456]);
		expect(chamada.notaIds).toEqual([7]);
	});

	test("fatura sem cobranças/notas → port chamada sem ids, erros: []", async () => {
		const f = faturaAemitirFixture({ status: "erro" });
		f.cobrancas = [];
		let cobrancaIds: number[] | null = null;
		let notaIds: number[] | null = null;
		const app = criarFaturasRoutes({
			atacado: fakeAtacado({
				getFaturaPorId: async () => f,
				// early return no repository (sem ids → sem call NocoBase)
				buscarErrosPorFatura: async (c, n) => { cobrancaIds = c; notaIds = n; return []; },
			} as any),
			queue: fakeQueue(),
		});
		const res = await app.request("/faturas/101/emissao");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.erros).toEqual([]);
		expect(cobrancaIds).toEqual([]);
		expect(notaIds).toEqual([]);
	});

	test("fatura não encontrada → 404", async () => {
		const app = criarFaturasRoutes({
			atacado: fakeAtacado({ getFaturaPorId: async () => null } as any),
			queue: fakeQueue(),
		});
		const res = await app.request("/faturas/999/emissao");
		expect(res.status).toBe(404);
	});
});

/** POST /faturas/:id/emitir — validação do id (SPEC-0001). */
describe("POST /faturas/:id/emitir — id inválido", () => {
	test("id não-inteiro (abc) → 422 VALIDACAO 'id inválido'", async () => {
		const app = criarFaturasRoutes({
			atacado: fakeAtacado(),
			queue: fakeQueue(),
		});
		const res = await app.request("/faturas/abc/emitir", { method: "POST" });
		expect(res.status).toBe(422);
		const body = await res.json();
		expect(body.erro.tipo).toBe("VALIDACAO");
		expect(body.erro.mensagem).toMatch(/id inválido/);
	});

	test("id <= 0 (0) → 422 VALIDACAO 'id inválido'", async () => {
		const app = criarFaturasRoutes({
			atacado: fakeAtacado(),
			queue: fakeQueue(),
		});
		const res = await app.request("/faturas/0/emitir", { method: "POST" });
		expect(res.status).toBe(422);
		const body = await res.json();
		expect(body.erro.tipo).toBe("VALIDACAO");
	});

	test("id <= 0 (-1) → 422 VALIDACAO 'id inválido'", async () => {
		const app = criarFaturasRoutes({
			atacado: fakeAtacado(),
			queue: fakeQueue(),
		});
		const res = await app.request("/faturas/-1/emitir", { method: "POST" });
		expect(res.status).toBe(422);
		const body = await res.json();
		expect(body.erro.tipo).toBe("VALIDACAO");
	});
});
