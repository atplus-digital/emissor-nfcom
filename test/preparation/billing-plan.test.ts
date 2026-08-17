import { describe, expect, test } from "bun:test";
import { criarFaturasRoutes } from "#/http/routes/faturas.route";
import { fakeAtacado, fakeQueue, clienteFixture } from "../http/_helpers";

/**
 * SPEC-0002 caso 12: via-parceiro e cofaturamento têm cardinalidade idêntica
 * (1 cobrança, N notas por cliente) — verificado em nível de rota.
 */
describe("POST /faturas/preparar — billing-plan (SPEC-0002 caso 12)", () => {
	test("via-parceiro e cofaturamento produzem 1 cobrança, N notas", async () => {
		const cli2 = clienteFixture({ id: 2, nome: "Cliente 2" });
		for (const tipo of ["via-parceiro", "cofaturamento"] as const) {
			const app = criarFaturasRoutes({
				atacado: fakeAtacado({ buscarClientesAtivosPorParceiro: async () => [clienteFixture(), cli2] }),
				queue: fakeQueue(),
			});
			const res = await app.request("/faturas/preparar", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ parceiroId: 42, dataReferencia: "2026-08-01", tipoFaturamento: tipo }),
			});
			expect(res.status).toBe(201);
			const body = await res.json();
			expect(body.cobrancas.length).toBe(1);
			expect(body.cobrancas[0].notas.length).toBe(2);
		}
	});

	test("parceiro: 1 cobrança, 1 nota (tudo agrupado)", async () => {
		const cli2 = clienteFixture({ id: 2, nome: "Cliente 2" });
		const app = criarFaturasRoutes({
			atacado: fakeAtacado({ buscarClientesAtivosPorParceiro: async () => [clienteFixture(), cli2] }),
			queue: fakeQueue(),
		});
		const res = await app.request("/faturas/preparar", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ parceiroId: 42, dataReferencia: "2026-08-01", tipoFaturamento: "parceiro" }),
		});
		expect(res.status).toBe(201);
		const body = await res.json();
		expect(body.cobrancas.length).toBe(1);
		expect(body.cobrancas[0].notas.length).toBe(1);
	});

	test("cliente-final: N cobranças (1 por cliente), N notas", async () => {
		const cli2 = clienteFixture({ id: 2, nome: "Cliente 2" });
		const app = criarFaturasRoutes({
			atacado: fakeAtacado({ buscarClientesAtivosPorParceiro: async () => [clienteFixture(), cli2] }),
			queue: fakeQueue(),
		});
		const res = await app.request("/faturas/preparar", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ parceiroId: 42, dataReferencia: "2026-08-01", tipoFaturamento: "cliente-final" }),
		});
		expect(res.status).toBe(201);
		const body = await res.json();
		expect(body.cobrancas.length).toBe(2);
		expect(body.cobrancas[0].notas.length).toBe(1);
		expect(body.cobrancas[1].notas.length).toBe(1);
	});
});
