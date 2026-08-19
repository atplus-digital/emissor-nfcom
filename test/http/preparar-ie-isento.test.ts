/**
 * Defeito B — fail-fast de IE isenta em `POST /faturas/preparar`
 * (src/http/routes/preparar.handler.ts): tipo `parceiro` tem o próprio parceiro
 * como destinatário da nota; se `parceiro.ie` não é numérica (f_ie="ISENTO"/vazio
 * no NocoBase) e não há fallback (`ieIsento` — `env.FISCAL_IE_ISENTO` ligada pelo
 * composition root), a emissão rejeitaria no worker (`IE do Destinatário não
 * informada`). O handler falha cedo com 422 VALIDACAO, sem criar boletos.
 *
 * Arquivo separado de `preparar.test.ts` para isolar o cenário (o fixture
 * padrão de parceiro tem `ie: "123"` válida — aqui exercita o branch isento).
 */
import { describe, expect, test, mock } from "bun:test";
import { executarPreparacao, type PrepararInput } from "#/http/routes/preparar.handler";
import {
	clienteFixture,
	fakeAtacado,
	parceiroFixture,
	planoFixture,
} from "./_helpers";

const INPUT_PARCEIRO: PrepararInput = {
	parceiroId: 42,
	dataReferencia: "2026-08-01",
	tipoFaturamento: "parceiro",
};

/** Deps válidas (passam o pré-filtro) com parceiro de IE isenta. */
function depsValidas(over: Parameters<typeof fakeAtacado>[0] = {}) {
	return fakeAtacado({
		buscarFaturaPorChave: async () => null,
		buscarParceiroPorId: async () => parceiroFixture({ ie: "ISENTO" }),
		buscarClientesAtivosPorParceiro: async () => [clienteFixture()],
		buscarPlanosDeServico: async () => [planoFixture()],
		criarFatura: async () => ({ id: 101 }),
		criarCobranca: async () => ({ id: 456 }),
		criarNota: async () => ({ id: 7 }),
		criarItem: async () => {},
		...over,
	});
}

describe("executarPreparacao — IE isenta no tipo parceiro (Defeito B)", () => {
	test("ie='ISENTO' e sem ieIsento → 422 VALIDACAO com mensagem clara", async () => {
		const r = await executarPreparacao({ atacado: depsValidas() }, INPUT_PARCEIRO);
		expect(r.status).toBe(422);
		const corpo = r.corpo as { erro: { tipo: string; mensagem: string } };
		expect(corpo.erro.tipo).toBe("VALIDACAO");
		expect(corpo.erro.mensagem).toContain("Parceiro sem IE válida (IE isenta)");
		expect(corpo.erro.mensagem).toContain("FISCAL_IE_ISENTO");
	});

	test("ie ausente (undefined) e sem ieIsento → 422 VALIDACAO", async () => {
		const r = await executarPreparacao(
			{ atacado: depsValidas({ buscarParceiroPorId: async () => parceiroFixture({ ie: undefined }) }) },
			INPUT_PARCEIRO,
		);
		expect(r.status).toBe(422);
		expect((r.corpo as { erro: { tipo: string } }).erro.tipo).toBe("VALIDACAO");
	});

	test("ie vazia ('') e sem ieIsento → 422 VALIDACAO", async () => {
		const r = await executarPreparacao(
			{ atacado: depsValidas({ buscarParceiroPorId: async () => parceiroFixture({ ie: "" }) }) },
			INPUT_PARCEIRO,
		);
		expect(r.status).toBe(422);
	});

	test("ie='ISENTO' + ieIsento configurado → segue (201, cria a árvore)", async () => {
		const criado = mock(async () => ({ id: 101 }));
		const r = await executarPreparacao(
			{
				atacado: depsValidas({ criarFatura: criado }),
				ieIsento: "000000000000",
			},
			INPUT_PARCEIRO,
		);
		expect(r.status).toBe(201);
		expect(criado).toHaveBeenCalledTimes(1);
	});

	test("ie numérica válida e sem ieIsento → segue (201)", async () => {
		const r = await executarPreparacao(
			{ atacado: depsValidas({ buscarParceiroPorId: async () => parceiroFixture({ ie: "12345678" }) }) },
			INPUT_PARCEIRO,
		);
		expect(r.status).toBe(201);
	});

	test("outros tipos (cliente-final) + ie isenta e sem ieIsento → não bloqueia (destinatário é o cliente)", async () => {
		const r = await executarPreparacao(
			{ atacado: depsValidas() },
			{ ...INPUT_PARCEIRO, tipoFaturamento: "cliente-final" },
		);
		expect(r.status).toBe(201);
	});
});
