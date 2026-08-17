import { describe, expect, test } from "bun:test";
import { criarFaturasRoutes } from "#/http/routes/faturas.route";
import { fakeAtacado, fakeQueue, clienteFixture } from "../http/_helpers";

/**
 * SPEC-0002 caso 7: falha no meio da persistência → rollback manual estrito
 * (remove a árvore já criada) e propaga erro (500 ERRO_INTERNO).
 */
describe("POST /faturas/preparar — rollback (SPEC-0002 caso 7)", () => {
	test("falha ao criar a 2ª cobrança (cliente-final, 2 clientes) → rollback + 500", async () => {
		let chamadas = 0;
		let removido = false;
		const cli2 = clienteFixture({ id: 2, nome: "Cliente 2" });
		const app = criarFaturasRoutes({
			atacado: fakeAtacado({
				buscarClientesAtivosPorParceiro: async () => [clienteFixture(), cli2],
				criarCobranca: async () => {
					chamadas++;
					if (chamadas === 2) throw new Error("boom");
					return { id: 456 + chamadas };
				},
				removerArvore: async () => { removido = true; },
			}),
			queue: fakeQueue(),
		});
		const res = await app.request("/faturas/preparar", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ parceiroId: 42, dataReferencia: "2026-08-01", tipoFaturamento: "cliente-final" }),
		});
		expect(res.status).toBe(500);
		expect(removido).toBe(true);
		const body = await res.json();
		expect(body.erro.tipo).toBe("ERRO_INTERNO");
	});

	test("falha ao criar nota → rollback + 500", async () => {
		let removido = false;
		const app = criarFaturasRoutes({
			atacado: fakeAtacado({
				criarNota: async () => { throw new Error("boom nota"); },
				removerArvore: async () => { removido = true; },
			}),
			queue: fakeQueue(),
		});
		const res = await app.request("/faturas/preparar", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ parceiroId: 42, dataReferencia: "2026-08-01", tipoFaturamento: "parceiro" }),
		});
		expect(res.status).toBe(500);
		expect(removido).toBe(true);
		const body = await res.json();
		expect(body.erro.tipo).toBe("ERRO_INTERNO");
	});
});
