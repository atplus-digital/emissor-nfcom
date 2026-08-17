import { describe, expect, it } from "bun:test";
import { calcularFatura } from "#/domain/fatura/calculo";
import type { Cliente, Parceiro, Plano } from "#/domain/types";

const parceiro: Parceiro = {
	id: 1, razaoSocial: "P", cnpj: "11444777000161", emailFaturamento: "p@x.com",
	diaVencimento: 10, endereco: { logradouro: "R", numero: "1", bairro: "C", cep: "80000000", cidade: "C", uf: "PR" },
};
const planos: Plano[] = [{ id: 1, descricao: "A", preco: 1000 }];

function cliente(id: number, nome: string, linhas: { planoId: number; unitario: number; quantidade: number }[]): Cliente {
	return {
		id, nome, cpfcnpj: "52998224725", email: "c@x.com",
		endereco: { logradouro: "R", numero: "1", bairro: "C", cep: "80000000", cidade: "C", uf: "PR" },
		linhas: linhas.map((l) => ({ planoId: l.planoId, descricao: "Plano", unitario: l.unitario, quantidade: l.quantidade })),
	};
}

describe("calcularFatura (SPEC-0002)", () => {
	it("total da fatura em centavos = soma das cobranças (caso 11: consistência)", () => {
		const clientes = [cliente(10, "João", [{ planoId: 1, unitario: 1000, quantidade: 2 }])];
		const { fatura, erros } = calcularFatura(parceiro, clientes, planos, "2026-08-01", "parceiro");
		expect(erros).toEqual([]);
		expect(fatura.valorTotal).toBe(2000);
		const somaCobrancas = fatura.cobrancas.reduce((a, c) => a + c.valorTotal, 0);
		expect(somaCobrancas).toBe(fatura.valorTotal);
	});

	it("descarta linhas sem plano (caso 9): cliente com linha de plano inexistente não a computa", () => {
		const clientes = [
			cliente(10, "João", [
				{ planoId: 1, unitario: 1000, quantidade: 1 }, // plano existe
				{ planoId: 999, unitario: 5000, quantidade: 1 }, // plano não existe → descarta
			]),
		];
		const { fatura, erros } = calcularFatura(parceiro, clientes, planos, "2026-08-01", "parceiro");
		expect(erros).toEqual([]);
		expect(fatura.valorTotal).toBe(1000); // só a linha válida
	});

	it("descarta linhas com preço zero (caso 9)", () => {
		const clientes = [
			cliente(10, "João", [
				{ planoId: 1, unitario: 1000, quantidade: 1 },
				{ planoId: 1, unitario: 0, quantidade: 2 }, // preço zero → descarta
			]),
		];
		const { fatura } = calcularFatura(parceiro, clientes, planos, "2026-08-01", "parceiro");
		expect(fatura.valorTotal).toBe(1000);
	});

	it("cliente que fica sem linhas válidas não entra no cálculo (caso 9 → caso 2 se todos)", () => {
		const clientes = [
			cliente(10, "João", [{ planoId: 1, unitario: 1000, quantidade: 1 }]),
			cliente(11, "Maria", [{ planoId: 999, unitario: 1000, quantidade: 1 }]), // todas linhas descartadas
		];
		const { fatura, erros } = calcularFatura(parceiro, clientes, planos, "2026-08-01", "parceiro");
		expect(erros).toEqual([]);
		expect(fatura.valorTotal).toBe(1000); // só João
		// Maria não gera nota (em via-parceiro seria 1 nota só, de João)
		expect(fatura.cobrancas[0].notas.length).toBe(1);
	});

	it("erro quando TODOS os clientes ficam sem linhas válidas (caso 2/9)", () => {
		const clientes = [cliente(10, "João", [{ planoId: 999, unitario: 1000, quantidade: 1 }])];
		const { erros } = calcularFatura(parceiro, clientes, planos, "2026-08-01", "parceiro");
		expect(erros.length).toBeGreaterThanOrEqual(1);
	});

	it("normaliza dataReferencia para o 1º dia e calcula vencimento no mês seguinte", () => {
		const clientes = [cliente(10, "João", [{ planoId: 1, unitario: 1000, quantidade: 1 }])];
		const { fatura } = calcularFatura(parceiro, clientes, planos, "2026-08-15", "parceiro");
		expect(fatura.dataReferencia).toBe("2026-08-01");
		expect(fatura.dataVencimento).toBe("2026-09-10");
	});
});
