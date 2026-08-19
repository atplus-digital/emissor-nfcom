/**
 * Caso 11 (consistência defensiva): soma das notas ≠ total da fatura → FATAL.
 *
 * O cálculo é determinístico (a divergência não ocorre no fluxo real), então o
 * branch é exercitado mockando `construirPlanoCobrancas` — `mock.module` antes
 * do import dinâmico do SUT (imports estáticos são hoisted; o módulo precisa ser
 * carregado DEPOIS do mock para o binding resolver o mock).
 */
import { describe, expect, mock, test } from "bun:test";
import type { DefaultsFiscais } from "#/domain/fatura/defaults-fiscais";
import type { Cobranca, Cliente, Parceiro, Plano } from "#/domain/types";

mock.module("#/domain/fatura/plano-cobrancas", () => ({
	construirPlanoCobrancas: (
		_clientes: Cliente[],
		_parceiro: Parceiro,
		_tipo: unknown,
		dataVencimento: string,
		_defaults: DefaultsFiscais,
	): Cobranca[] => [
		{
			faturaId: 0,
			valorTotal: 10000,
			nomeDevedor: "P",
			documentoDevedor: "12345678000199",
			emailDevedor: "p@x.com",
			status: "a-emitir",
			dataVencimento,
			// Divergência deliberada: a nota soma 5000, a cobrança diz 10000.
			notas: [
				{
					cobrancaId: 0,
					nome: "P",
					cpfcnpj: "12345678000199",
					email: "p@x.com",
					endereco: { logradouro: "R", numero: "1", bairro: "C", cep: "80", cidade: "C", uf: "PR" },
					statusInterno: "a-emitir",
					total: 5000,
					itens: [],
				},
			],
		},
	],
}));

const { calcularFatura } = await import("#/domain/fatura/calculo");

const parceiro: Parceiro = {
	id: 1, razaoSocial: "P", cnpj: "11444777000161", emailFaturamento: "p@x.com",
	diaVencimento: 10, endereco: { logradouro: "R", numero: "1", bairro: "C", cep: "80000000", cidade: "C", uf: "PR" },
};
const clientes: Cliente[] = [{
	id: 10, nome: "João", cpfcnpj: "52998224725", email: "c@x.com",
	endereco: { logradouro: "R", numero: "1", bairro: "C", cep: "80000000", cidade: "C", uf: "PR" },
	linhas: [{ planoId: 1, descricao: "Plano", unitario: 1000, quantidade: 1 }],
}];
const planos: Plano[] = [{ id: 1, descricao: "A", preco: 1000 }];
const defaults: DefaultsFiscais = { cfop: "6102", cclass: "XXXX", aliqIcms: 0 };

describe("calcularFatura — caso 11 (consistência defensiva)", () => {
	test("soma das notas ≠ total da fatura → erro FATAL SOMA_DIVERGENTE", () => {
		const { fatura, erros } = calcularFatura(parceiro, clientes, planos, "2026-08-01", "parceiro", defaults);
		expect(fatura.valorTotal).toBe(10000);
		expect(erros).toEqual([
			expect.objectContaining({
				tipo: "FATAL",
				codigo: "SOMA_DIVERGENTE",
				mensagem: expect.stringContaining("≠"),
			}),
		]);
	});
});
