import { describe, expect, test } from "bun:test";
import { criarFaturasRoutes } from "#/http/routes/faturas.route";
import { fakeAtacado, fakeQueue, faturaAemitirFixture } from "../http/_helpers";

/**
 * SPEC-0002 upsert por chave natural: casos 5 (409 emitindo/emitida/parcial/erro),
 * 6 (atualização 200 remove+recria), 14 (409 pago/cancelada).
 */
describe("POST /faturas/preparar — upsert (SPEC-0002 casos 5,6,14)", () => {
	test("caso 5: fatura emitindo → 409", async () => {
		const app = criarFaturasRoutes({
			atacado: fakeAtacado({
				buscarFaturaPorChave: async () => faturaAemitirFixture({ status: "emitindo" }),
			}),
			queue: fakeQueue(),
		});
		const res = await app.request("/faturas/preparar", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ parceiroId: 42, dataReferencia: "2026-08-01", tipoFaturamento: "parceiro" }),
		});
		expect(res.status).toBe(409);
		const body = await res.json();
		expect(body.erro.tipo).toBe("CONFLITO");
	});

	test("caso 5: fatura emitida → 409", async () => {
		const app = criarFaturasRoutes({
			atacado: fakeAtacado({
				buscarFaturaPorChave: async () => faturaAemitirFixture({ status: "emitida" }),
			}),
			queue: fakeQueue(),
		});
		const res = await app.request("/faturas/preparar", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ parceiroId: 42, dataReferencia: "2026-08-01", tipoFaturamento: "parceiro" }),
		});
		expect(res.status).toBe(409);
	});

	test("caso 14: fatura pago → 409", async () => {
		const app = criarFaturasRoutes({
			atacado: fakeAtacado({
				buscarFaturaPorChave: async () => faturaAemitirFixture({ status: "pago" }),
			}),
			queue: fakeQueue(),
		});
		const res = await app.request("/faturas/preparar", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ parceiroId: 42, dataReferencia: "2026-08-01", tipoFaturamento: "parceiro" }),
		});
		expect(res.status).toBe(409);
	});

	test("caso 14: fatura cancelada → 409", async () => {
		const app = criarFaturasRoutes({
			atacado: fakeAtacado({
				buscarFaturaPorChave: async () => faturaAemitirFixture({ status: "cancelada" }),
			}),
			queue: fakeQueue(),
		});
		const res = await app.request("/faturas/preparar", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ parceiroId: 42, dataReferencia: "2026-08-01", tipoFaturamento: "parceiro" }),
		});
		expect(res.status).toBe(409);
	});

	test("caso 6: fatura a-emitir existente → atualização 200 (remove+recria árvore)", async () => {
		let removido = false;
		const app = criarFaturasRoutes({
			atacado: fakeAtacado({
				buscarFaturaPorChave: async () => faturaAemitirFixture({ status: "a-emitir" }),
				removerArvore: async () => { removido = true; },
			}),
			queue: fakeQueue(),
		});
		const res = await app.request("/faturas/preparar", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ parceiroId: 42, dataReferencia: "2026-08-15", tipoFaturamento: "parceiro" }),
		});
		expect(res.status).toBe(200);
		expect(removido).toBe(true);
		const body = await res.json();
		expect(body.status).toBe("a-emitir");
	});

	test("criação: fatura inexistente → 201", async () => {
		const app = criarFaturasRoutes({
			atacado: fakeAtacado({ buscarFaturaPorChave: async () => null }),
			queue: fakeQueue(),
		});
		const res = await app.request("/faturas/preparar", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ parceiroId: 42, dataReferencia: "2026-08-01", tipoFaturamento: "parceiro" }),
		});
		expect(res.status).toBe(201);
	});

	test("criação: resposta traz os IDs reais retornados pelo Atacado (não fake)", async () => {
		const app = criarFaturasRoutes({
			atacado: fakeAtacado({
				buscarFaturaPorChave: async () => null,
				criarFatura: async () => ({ id: 9001 }),
				criarCobranca: async () => ({ id: 1001 }),
				criarNota: async () => ({ id: 2002 }),
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
		expect(body.faturaId).toBe(9001);
		expect(body.cobrancas[0].id).toBe(1001);
		expect(body.cobrancas[0].notas[0].id).toBe(2002);
		expect(body.cobrancas[0].notas[0].cobrancaId).toBe(1001);
	});
});
