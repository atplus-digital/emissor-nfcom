import { describe, expect, test, mock } from "bun:test";
import { criarFaturasRoutes } from "#/http/routes/faturas.route";
import {
	classificarErrosCalculo,
	executarPreparacao,
	type PrepararInput,
} from "#/http/routes/preparar.handler";
import {
	clienteFixture,
	fakeAtacado,
	fakeQueue,
	parceiroFixture,
	planoFixture,
} from "./_helpers";

const BODY: PrepararInput = {
	parceiroId: 42,
	dataReferencia: "2026-08-01",
	tipoFaturamento: "parceiro",
};

function appPreparar(over: Parameters<typeof fakeAtacado>[0] = {}) {
	return criarFaturasRoutes({
		atacado: fakeAtacado(over),
		queue: fakeQueue(),
	});
}

function post(app: ReturnType<typeof criarFaturasRoutes>, body: unknown) {
	return app.request("/faturas/preparar", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
	});
}

/** Fake com todos os dados de domínio válidos (criação 201 feliz). */
function prepararDepsValidos() {
	return fakeAtacado({
		buscarFaturaPorChave: async () => null,
		buscarParceiroPorId: async () => parceiroFixture(),
		buscarClientesAtivosPorParceiro: async () => [clienteFixture()],
		buscarPlanosDeServico: async () => [planoFixture()],
		criarFatura: async () => ({ id: 101 }),
		criarCobranca: async () => ({ id: 456 }),
		criarNota: async () => ({ id: 7 }),
		criarItem: async () => {},
	});
}

/** Fatura a-emitir existente p/ exercitar o modo atualização (caso 6). */
const EXISTENTE_EMITIR = { id: 101, status: "a-emitir" } as never;

describe("POST /faturas/preparar — rota fina (M7) + upsert preserva árvore (m13)", () => {
	test("sucesso em criação → 201 com árvore de IDs reais", async () => {
		const res = await post(appPreparar(prepararDepsValidos()), BODY);
		expect(res.status).toBe(201);
		const body = await res.json();
		expect(body.faturaId).toBe(101);
		expect(body.cobrancas[0].id).toBe(456);
		expect(body.cobrancas[0].notas[0].id).toBe(7);
	});

	test("m13: re-POST inválido (parceiro sumiu) NÃO remove a árvore antiga", async () => {
		const removido = mock(() => Promise.resolve());
		const atacado = fakeAtacado({
			// Existente a-emitir → modo atualização.
			buscarFaturaPorChave: async () => EXISTENTE_EMITIR,
			// Caso 1: parceiro não encontrado → validação de domínio falha.
			buscarParceiroPorId: async () => null,
			removerArvore: removido,
		});
		const res = await post(appPreparar(atacado), BODY);
		expect(res.status).toBe(422);
		expect(removido).not.toHaveBeenCalled();
	});

	test("m13: re-POST válido → atualização (200) e remove a árvore antiga", async () => {
		const removido = mock(() => Promise.resolve());
		const atacado = fakeAtacado({
			buscarFaturaPorChave: async () => EXISTENTE_EMITIR,
			buscarParceiroPorId: async () => parceiroFixture(),
			buscarClientesAtivosPorParceiro: async () => [clienteFixture()],
			buscarPlanosDeServico: async () => [planoFixture()],
			removerArvore: removido,
			criarCobranca: async () => ({ id: 456 }),
			criarNota: async () => ({ id: 7 }),
			criarItem: async () => {},
		});
		const res = await post(appPreparar(atacado), BODY);
		expect(res.status).toBe(200);
		expect((await res.json()).faturaId).toBe(101);
		expect(removido).toHaveBeenCalledWith(101);
	});

	test("parceiro não encontrado → 422 VALIDACAO", async () => {
		const atacado = fakeAtacado({ buscarParceiroPorId: async () => null });
		const res = await post(appPreparar(atacado), BODY);
		expect(res.status).toBe(422);
		expect((await res.json()).erro.tipo).toBe("VALIDACAO");
	});

	test("fatura já em emissão → 409 CONFLITO", async () => {
		const atacado = fakeAtacado({ buscarFaturaPorChave: async () => ({ id: 101, status: "emitida" }) as never });
		const res = await post(appPreparar(atacado), BODY);
		expect(res.status).toBe(409);
		expect((await res.json()).erro.tipo).toBe("CONFLITO");
	});

	test("nenhum cliente com linhas válidas → 422 VALIDACAO", async () => {
		const atacado = fakeAtacado({ buscarClientesAtivosPorParceiro: async () => [] });
		const res = await post(appPreparar(atacado), BODY);
		expect(res.status).toBe(422);
	});
});

describe("classificarErrosCalculo (M10 — caso 11 divergência de soma)", () => {
	test("divergência de soma → 500 ERRO_INTERNO (defensivo)", () => {
		const { status, tipo } = classificarErrosCalculo([
			{ tipo: "FATAL", mensagem: "Inconsistência de cálculo: soma das notas (1200) ≠ total da fatura (1100)" },
		]);
		expect(status).toBe(500);
		expect(tipo).toBe("ERRO_INTERNO");
	});

	test("erro de cálculo sem divergência → 422 VALIDACAO", () => {
		const { status, tipo } = classificarErrosCalculo([
			{ tipo: "FATAL", mensagem: "Nenhum cliente com linhas ativas encontrado para faturamento" },
		]);
		expect(status).toBe(422);
		expect(tipo).toBe("VALIDACAO");
	});
});

describe("executarPreparacao — contrato do handler (M7)", () => {
	test("retorna {corpo,status} sem lançar em fluxo feliz", async () => {
		const resultado = await executarPreparacao(
			{ atacado: prepararDepsValidos() },
			BODY,
		);
		expect(resultado.status).toBe(201);
		expect((resultado.corpo as { faturaId: number }).faturaId).toBe(101);
	});
});
