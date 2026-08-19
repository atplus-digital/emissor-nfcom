/**
 * Cobre o branch `errosCalc.length > 0` de `executarPreparacao`
 * (src/http/routes/preparar.handler.ts linhas 143-146): quando `calcularFatura`
 * retorna erros de cálculo, o handler classifica (classificarErrosCalculo) e
 * responde 422 VALIDACAO (ou 500 ERRO_INTERNO p/ SOMA_DIVERGENTE) com a lista
 * de erros no detalhe.
 *
 * Arquivo separado de `preparar.test.ts` porque mockamos `#/domain/fatura/calculo`
 * (por processo, --isolate) para forçar o retorno de erros — o pré-filtro do
 * handler (linhas 126-132) e o `calcularFatura` usam a MESMA lógica de filtro,
 * então com dados reais o branch de erros de cálculo é inalcançável (o pré-filtro
 * já responde 422 antes).
 */
import { describe, expect, test, mock } from "bun:test";

mock.module("#/domain/fatura/calculo", () => ({
	calcularFatura: () => ({
		fatura: {
			parceiroId: 42,
			dataReferencia: "2026-08-01",
			dataVencimento: "2026-09-10",
			valorTotal: 0,
			tipoFaturamento: "parceiro",
			status: "a-emitir",
			cobrancas: [],
		},
		erros: [
			{ tipo: "FATAL", codigo: "SEM_CLIENTES", mensagem: "Nenhum cliente com linhas ativas encontrado para faturamento" },
		],
	}),
}));

import { executarPreparacao } from "#/http/routes/preparar.handler";
import { fakeAtacado, parceiroFixture, clienteFixture, planoFixture } from "./_helpers";

const INPUT = { parceiroId: 42, dataReferencia: "2026-08-01", tipoFaturamento: "parceiro" as const };

/** Deps válidas (passam o pré-filtro) — o erro vem do calcularFatura mockado. */
function depsValidas() {
	return fakeAtacado({
		buscarFaturaPorChave: async () => null,
		buscarParceiroPorId: async () => parceiroFixture(),
		buscarClientesAtivosPorParceiro: async () => [clienteFixture()],
		buscarPlanosDeServico: async () => [planoFixture()],
	});
}

describe("executarPreparacao — branch errosCalc.length > 0 (M10)", () => {
	test("erro de cálculo SEM_CLIENTES → 422 VALIDACAO com a lista de erros no detalhe", async () => {
		const r = await executarPreparacao({ atacado: depsValidas() }, INPUT);
		expect(r.status).toBe(422);
		const corpo = r.corpo as { erro: { tipo: string; mensagem: string; detalhe: { erros: unknown[] } } };
		expect(corpo.erro.tipo).toBe("VALIDACAO");
		expect(corpo.erro.mensagem).toMatch(/Nenhum cliente com linhas ativas/);
		expect(Array.isArray(corpo.erro.detalhe.erros)).toBe(true);
		expect(corpo.erro.detalhe.erros[0]).toMatchObject({ codigo: "SEM_CLIENTES" });
	});
});
