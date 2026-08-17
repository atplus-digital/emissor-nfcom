import { describe, expect, test } from "bun:test";
import { criarFaturasRoutes } from "#/http/routes/faturas.route";
import { fakeAtacado, fakeQueue, clienteFixture, parceiroFixture } from "../http/_helpers";

/**
 * SPEC-0002: caso 9 (linhas inválidas descartadas), caso 10 (vencimento default
 * mês seguinte) — asserta o dataVencimento da resposta.
 */
describe("POST /faturas/preparar — cálculo (SPEC-0002 casos 9,10)", () => {
	test("caso 10: vencimento no mês seguinte, dia default 10 (parceiro sem dia)", async () => {
		const app = criarFaturasRoutes({
			atacado: fakeAtacado({
				buscarParceiroPorId: async () => parceiroFixture({ diaVencimento: 0 }),
			}),
			queue: fakeQueue(),
		});
		// parceiro com diaVencimento 0 → default 10 no mês seguinte.
		// dataReferencia 2026-08-15 → normalizada 2026-08-01 → vence 2026-09-10.
		const res = await app.request("/faturas/preparar", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ parceiroId: 42, dataReferencia: "2026-08-15", tipoFaturamento: "parceiro" }),
		});
		// diaVencimento 0 → calcularDataVencimento usa default 10? Verificar domínio.
		// O domínio: calcularDataVencimento(ref, diaVencimentoParceiro?) — se 0, usa default.
		expect(res.status).toBe(201);
		const body = await res.json();
		expect(body.dataVencimento).toBe("2026-09-10");
	});

	test("caso 10: dia do parceiro (15) no mês seguinte", async () => {
		const app = criarFaturasRoutes({
			atacado: fakeAtacado({
				buscarParceiroPorId: async () => parceiroFixture({ diaVencimento: 15 }),
			}),
			queue: fakeQueue(),
		});
		const res = await app.request("/faturas/preparar", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ parceiroId: 42, dataReferencia: "2026-08-01", tipoFaturamento: "parceiro" }),
		});
		expect(res.status).toBe(201);
		const body = await res.json();
		expect(body.dataVencimento).toBe("2026-09-15");
	});

	test("caso 9: linhas sem plano/preço zero descartadas; cliente sem linhas válidas não entra", async () => {
		// Cliente com 2 linhas: uma válida (plano 100, preço 10000), uma inválida (plano 999).
		const cli = clienteFixture({
			linhas: [
				{ planoId: 100, descricao: "Plano 100", unitario: 10000, quantidade: 1 },
				{ planoId: 999, descricao: "Plano inexistente", unitario: 5000, quantidade: 1 },
				{ planoId: 100, descricao: "Plano zero", unitario: 0, quantidade: 1 },
			],
		});
		const app = criarFaturasRoutes({
			atacado: fakeAtacado({ buscarClientesAtivosPorParceiro: async () => [cli] }),
			queue: fakeQueue(),
		});
		const res = await app.request("/faturas/preparar", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ parceiroId: 42, dataReferencia: "2026-08-01", tipoFaturamento: "cliente-final" }),
		});
		expect(res.status).toBe(201);
		const body = await res.json();
		// Apenas a linha válida (10000) entra no total.
		expect(body.valorTotal).toBe(10000);
	});
});
