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

	test("fatura não encontrada → 404", async () => {
		const app = criarFaturasRoutes({
			atacado: fakeAtacado({ getFaturaPorId: async () => null } as any),
			queue: fakeQueue(),
		});
		const res = await app.request("/faturas/999/emissao");
		expect(res.status).toBe(404);
	});
});
