import { describe, expect, it } from "bun:test";
import {
	validarDocumentos,
	validarEnderecoDestinatario,
} from "#/domain/fatura/validacao";
import type { Cliente, Nota, Parceiro } from "#/domain/types";

const parceiro: Parceiro = {
	id: 1,
	razaoSocial: "Parceiro Ltda",
	cnpj: "11444777000161",
	emailFaturamento: "fin@parceiro.com",
	diaVencimento: 10,
	endereco: { logradouro: "Rua", numero: "1", bairro: "Centro", cep: "80000000", cidade: "Curitiba", uf: "PR" },
};

function nota(nome: string, cpfcnpj: string, endereco?: Nota["endereco"]): Nota {
	return {
		cobrancaId: 1, nome, cpfcnpj, endereco: endereco ?? { logradouro: "Rua", numero: "1", bairro: "Centro", cep: "80000000", cidade: "Curitiba", uf: "PR" },
		uf: "PR", cidade: "Curitiba", statusInterno: "a-emitir", total: 0, itens: [],
	};
}

describe("validarDocumentos (SPEC-0002 caso 4)", () => {
	it("retorna vazio quando devedor e destinatários têm dígito válido", () => {
		const clientes: Cliente[] = [];
		const notas = [nota("Cliente", "52998224725")];
		expect(validarDocumentos(parceiro, notas, clientes)).toEqual([]);
	});

	it("retorna erro quando o devedor (parceiro) tem CNPJ inválido", () => {
		const parceiroBad = { ...parceiro, cnpj: "11444777000162" };
		const erros = validarDocumentos(parceiroBad, [], []);
		expect(erros.length).toBe(1);
		expect(erros[0]?.mensagem).toContain("devedor");
	});

	it("retorna erro quando um destinatário de nota tem CPF inválido", () => {
		const notas = [nota("Cliente", "52998224726")];
		const erros = validarDocumentos(parceiro, notas, []);
		expect(erros.length).toBeGreaterThanOrEqual(1);
		expect(erros[0]?.mensagem).toContain("Cliente");
	});

	it("retorna erro quando um cliente tem documento inválido", () => {
		const clienteBad: Cliente = { id: 2, nome: "Ruim", cpfcnpj: "00000000000", endereco: parceiro.endereco, linhas: [] };
		const erros = validarDocumentos(parceiro, [], [clienteBad]);
		expect(erros.length).toBeGreaterThanOrEqual(1);
	});
});

describe("validarEnderecoDestinatario (SPEC-0002 caso 13)", () => {
	function notaComEndereco(end: Partial<Nota["endereco"]>): Nota {
		return nota("Cliente X", "52998224725", { logradouro: end.logradouro ?? "", numero: end.numero ?? "", bairro: end.bairro ?? "", cep: end.cep ?? "", cidade: end.cidade ?? "", uf: end.uf ?? "" });
	}

	it("retorna vazio quando todos os endereços estão completos", () => {
		expect(validarEnderecoDestinatario([nota("A", "52998224725")])).toEqual([]);
	});

	it("retorna erro quando o logradouro está ausente", () => {
		const erros = validarEnderecoDestinatario([notaComEndereco({ logradouro: "", numero: "1", bairro: "C", cep: "80000000", cidade: "C", uf: "PR" })]);
		expect(erros[0]?.mensagem).toContain("Cliente X");
	});

	it("retorna erro para cada campo ausente (logradouro, numero, bairro, cep, cidade, uf)", () => {
		const erros = validarEnderecoDestinatario([notaComEndereco({})]);
		expect(erros.length).toBeGreaterThanOrEqual(1);
	});
});
