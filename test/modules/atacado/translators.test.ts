import { describe, expect, it } from "bun:test";
import {
	realToCents,
	centsToReal,
	desmascararDoc,
} from "#/modules/atacado/translators/money";
import { parceiroToDomain } from "#/modules/atacado/translators/parceiro";
import { clienteToDomain } from "#/modules/atacado/translators/cliente";
import { faturaToCreate, faturaToDomain } from "#/modules/atacado/translators/fatura";
import { cobrancaToCreate, cobrancaToDomain } from "#/modules/atacado/translators/cobranca";
import { notaToCreate, notaToDomain } from "#/modules/atacado/translators/nota";
import { itemToCreate, itemToDomain } from "#/modules/atacado/translators/item";

describe("translators/money", () => {
	it("realToCents converte número em unidade real para centavos", () => {
		expect(realToCents(123.45)).toBe(12345);
		expect(realToCents(0)).toBe(0);
		expect(realToCents(1)).toBe(100);
		expect(realToCents(1.99)).toBe(199);
	});

	it("realToCents arredonda determinístico (Math.round sobre *100)", () => {
		// 1.234 * 100 = 123.4 → 123
		expect(realToCents(1.234)).toBe(123);
		// 1.236 * 100 = 123.6 → 124
		expect(realToCents(1.236)).toBe(124);
		// nota: 1.005*100 = 100.4999.. (float) → 100; o arredondamento é determinístico,
		// não banca half-up em meio exato — consistente é o que importa.
	});

	it("realToCents aceita string com vírgula (formato NocoBase)", () => {
		expect(realToCents("123,45")).toBe(12345);
		expect(realToCents("1.234,56")).toBe(123456); // pt-BR: 1.234,56 = 1234.56
		expect(realToCents("0,99")).toBe(99);
	});

	it("realToCents aceita string com ponto (formato JSON)", () => {
		expect(realToCents("123.45")).toBe(12345);
	});

	it("centsToReal converte centavos para unidade real (number)", () => {
		expect(centsToReal(12345)).toBe(123.45);
		expect(centsToReal(0)).toBe(0);
		expect(centsToReal(199)).toBe(1.99);
	});

	it("centsToReal / realToCents são inversos (round-trip)", () => {
		for (const c of [0, 1, 99, 100, 12345, 99999]) {
			expect(realToCents(centsToReal(c))).toBe(c);
		}
	});
});

describe("translators/document", () => {
	it("desmascararDoc remove . e - de CPF/CNPJ", () => {
		expect(desmascararDoc("123.456.789-09")).toBe("12345678909");
		expect(desmascararDoc("12.345.678/0001-99")).toBe("12345678000199");
		expect(desmascararDoc("12345678909")).toBe("12345678909");
		expect(desmascararDoc("")).toBe("");
	});
});

describe("translators/parceiro", () => {
	it("parceiroToDomain mapeia f_* → Parceiro (centavos, doc limpo)", () => {
		const externo = {
			id: 42,
			f_razao_social: "Parceiro Ltda",
			f_fantasia: "Parceiro",
			f_cnpj: "12.345.678/0001-99",
			f_email_faturamento: "fin@parceiro.com",
			f_data_vencimento: 15,
			f_endereco: "Rua Exemplo",
			f_numero: "123",
			f_bairro: "Centro",
			f_cep: "80000-000",
			f_cidade: "Curitiba",
			f_uf: "PR",
			f_ie: "123",
		};
		const p = parceiroToDomain(externo);
		expect(p).toEqual({
			id: 42,
			razaoSocial: "Parceiro Ltda",
			fantasia: "Parceiro",
			cnpj: "12345678000199",
			emailFaturamento: "fin@parceiro.com",
			diaVencimento: 15,
			endereco: {
				logradouro: "Rua Exemplo",
				numero: "123",
				bairro: "Centro",
				cep: "80000-000",
				cidade: "Curitiba",
				uf: "PR",
			},
			ie: "123",
		});
	});

	it("parceiroToDomain usa dia 10 quando f_data_vencimento ausente/zero", () => {
		const base = {
			id: 1,
			f_razao_social: "X",
			f_cnpj: "11.222.333/0001-44",
			f_email_faturamento: "x@x.com",
			f_endereco: "r",
			f_numero: "1",
			f_bairro: "b",
			f_cep: "c",
			f_cidade: "ct",
			f_uf: "PR",
		};
		expect(parceiroToDomain({ ...base, f_data_vencimento: 0 }).diaVencimento).toBe(10);
		expect(
			parceiroToDomain({ ...base, f_data_vencimento: undefined as unknown as number }).diaVencimento,
		).toBe(10);
	});
});

describe("translators/cliente", () => {
	it("clienteToDomain mapeia f_* → Cliente com linhas do plano", () => {
		const externo = {
			id: 7,
			f_nome_razao: "Cliente Final",
			f_fantasia: "Cliente",
			f_cpf_cnpj: "111.222.333-44",
			f_email: "c@x.com",
			f_endereco: "Rua X",
			f_numero: "10",
			f_bairro: "B",
			f_cep: "80000-000",
			f_cidade: "Curitiba",
			f_uf: "PR",
			f_linhas_fixas: [
				{
					id: 100,
					f_qtde_servicos: 2,
					f_planos_de_servico: {
						id: 5,
						f_nome: "Plano Voz",
						f_assinatura_mensal: 99.9,
					},
				},
			],
		};
		const c = clienteToDomain(externo);
		expect(c.id).toBe(7);
		expect(c.nome).toBe("Cliente Final");
		expect(c.cpfcnpj).toBe("11122233344");
		expect(c.linhas).toHaveLength(1);
		expect(c.linhas[0]).toEqual({
			planoId: 5,
			descricao: "Plano Voz",
			unitario: 9990,
			quantidade: 2,
		});
	});

	it("clienteToDomain lida com linhas sem plano (ignora)", () => {
		const externo = {
			id: 7,
			f_nome_razao: "C",
			f_cpf_cnpj: "111.222.333-44",
			f_email: "",
			f_endereco: "r",
			f_numero: "1",
			f_bairro: "b",
			f_cep: "c",
			f_cidade: "ct",
			f_uf: "PR",
			f_linhas_fixas: [
				{ id: 1, f_qtde_servicos: 1, f_planos_de_servico: null },
				{
					id: 2,
					f_qtde_servicos: 1,
					f_planos_de_servico: { id: 5, f_nome: "P", f_assinatura_mensal: 0 },
				},
			],
		};
		const c = clienteToDomain(externo);
		// linha com plano preço zero entra (validação de preço zero é no cálculo, não aqui)
		expect(c.linhas).toHaveLength(1);
		expect(c.linhas[0].planoId).toBe(5);
	});
});

describe("translators/fatura", () => {
	it("faturaToCreate mapeia domínio → f_* (centavos → real)", () => {
		const input = {
			parceiroId: 42,
			dataReferencia: "2026-08-01",
			dataVencimento: "2026-09-10",
			valorTotal: 12345,
			tipoFaturamento: "cofaturamento" as const,
			status: "a-emitir" as const,
		};
		expect(faturaToCreate(input)).toEqual({
			f_fk_parceiro: 42,
			f_data_referencia: "2026-08-01",
			f_data_vencimento: "2026-09-10",
			f_valor_total: 123.45,
			f_tipo_de_faturamento: "cofaturamento",
			f_status: "a-emitir",
		});
	});

	it("faturaToDomain mapeia f_* (com cobranças/notas) → Fatura", () => {
		const externo = {
			id: 101,
			f_fk_parceiro: 42,
			f_data_referencia: "2026-08-01",
			f_data_vencimento: "2026-09-10",
			f_valor_total: 123.45,
			f_tipo_de_faturamento: "cofaturamento",
			f_status: "a-emitir",
			f_cobrancas: [
				{
					id: 456,
					f_fk_fatura: 101,
					f_valor_total: 123.45,
					f_nome_devedor: "Parceiro Ltda",
					f_documento_devedor: "12.345.678/0001-99",
					f_email_devedor: "fin@parceiro.com",
					f_status: "a-emitir",
					f_data_vencimento: "2026-09-10",
					f_id_externo: "",
					f_link_fatura: "",
					f_data_emissao: "",
					f_notas_fiscais: [],
				},
			],
		};
		const f = faturaToDomain(externo);
		expect(f.id).toBe(101);
		expect(f.parceiroId).toBe(42);
		expect(f.valorTotal).toBe(12345);
		expect(f.cobrancas).toHaveLength(1);
		expect(f.cobrancas[0].documentoDevedor).toBe("12345678000199");
	});
});

describe("translators/cobranca", () => {
	it("cobrancaToCreate mapeia domínio → f_*", () => {
		const input = {
			valorTotal: 12345,
			nomeDevedor: "X Ltda",
			documentoDevedor: "12345678000199",
			emailDevedor: "x@x.com",
			status: "a-emitir" as const,
			dataVencimento: "2026-09-10",
		};
		expect(cobrancaToCreate(input)).toEqual({
			f_valor_total: 123.45,
			f_nome_devedor: "X Ltda",
			f_documento_devedor: "12345678000199",
			f_email_devedor: "x@x.com",
			f_status: "a-emitir",
			f_data_vencimento: "2026-09-10",
		});
	});

	it("cobrancaToDomain mapeia f_* → Cobranca com notas", () => {
		const externo = {
			id: 456,
			f_fk_fatura: 101,
			f_valor_total: 123.45,
			f_nome_devedor: "X",
			f_documento_devedor: "12.345.678/0001-99",
			f_email_devedor: "x@x.com",
			f_status: "a-emitir",
			f_data_vencimento: "2026-09-10",
			f_id_externo: "ext_123",
			f_link_fatura: "http://link",
			f_data_emissao: "2026-08-17",
			f_notas_fiscais: [],
		};
		const c = cobrancaToDomain(externo, 101);
		expect(c.id).toBe(456);
		expect(c.faturaId).toBe(101);
		expect(c.valorTotal).toBe(12345);
		expect(c.idExterno).toBe("ext_123");
		expect(c.dataEmissao).toBe("2026-08-17");
	});
});

describe("translators/nota", () => {
	it("notaToCreate mapeia domínio → f_* (endereço plano)", () => {
		const input = {
			nome: "Cliente",
			cpfcnpj: "11122233344",
			email: "c@x.com",
			endereco: {
				logradouro: "Rua X",
				numero: "10",
				bairro: "B",
				cep: "80000-000",
				cidade: "Curitiba",
				uf: "PR",
			},
			rgie: "123",
			telefone: "4133333333",
			uf: "PR",
			cidade: "Curitiba",
			statusInterno: "a-emitir" as const,
			total: 12345,
		};
		expect(notaToCreate(input)).toEqual({
			f_nome: "Cliente",
			f_cpfcnpj: "11122233344",
			f_email: "c@x.com",
			f_endereco: "Rua X",
			f_endereco_numero: "10",
			f_bairro: "B",
			f_cep: "80000-000",
			f_cidade: "Curitiba",
			f_uf: "PR",
			f_rgie: "123",
			f_telefone: "4133333333",
			f_status_interno: "a-emitir",
			f_total: 123.45,
		});
	});

	it("notaToDomain mapeia f_* → Nota com itens", () => {
		const externo = {
			id: 7,
			f_fk_cobranca: 456,
			f_nome: "Cliente",
			f_cpfcnpj: "111.222.333-44",
			f_email: "c@x.com",
			f_endereco: "Rua X",
			f_endereco_numero: "10",
			f_bairro: "B",
			f_cep: "80000-000",
			f_cidade: "Curitiba",
			f_uf: "PR",
			f_rgie: "123",
			f_telefone: "4133333333",
			f_status_interno: "emitida",
			f_situacao: "autorizada",
			f_numero: 123,
			f_serie: 1,
			f_chave: "chave44",
			f_protocolo: "prot",
			f_pdf: "http://pdf",
			f_xml: "http://xml",
			f_total: 123.45,
			f_nota_itens: [],
		};
		const n = notaToDomain(externo, 456);
		expect(n.id).toBe(7);
		expect(n.cobrancaId).toBe(456);
		expect(n.cpfcnpj).toBe("11122233344");
		expect(n.statusInterno).toBe("emitida");
		expect(n.situacao).toBe("autorizada");
		expect(n.pdfUrl).toBe("http://pdf");
	});
});

describe("translators/item", () => {
	it("itemToCreate mapeia domínio → f_* (centavos → real)", () => {
		const input = {
			codigo: "COD1",
			descricao: "Serviço",
			cfop: "6102",
			cclass: "0001",
			quantidade: 2,
			unitario: 9990,
			total: 19980,
			aliqIcms: 0.18,
			bcIcms: 19980,
			icms: 3596,
			incideAliquota: true,
		};
		expect(itemToCreate(input)).toEqual({
			f_codigo: "COD1",
			f_descricao: "Serviço",
			f_cfop: "6102",
			f_cclass: "0001",
			f_quantidade: 2,
			f_unitario: 99.9,
			f_total: 199.8,
			f_aliq_icms: 0.18,
			f_bc_icms: 199.8,
			f_icms: 35.96,
			f_incide_aliquota: true,
		});
	});

	it("itemToDomain mapeia f_* → Item (centavos)", () => {
		const externo = {
			id: 1,
			f_item: 1,
			f_codigo: "COD1",
			f_descricao: "Serviço",
			f_cfop: "6102",
			f_cclass: "0001",
			f_quantidade: 2,
			f_unitario: 99.9,
			f_total: 199.8,
			f_aliq_icms: 0.18,
			f_bc_icms: 199.8,
			f_icms: 35.96,
			f_incide_aliquota: true,
		};
		const i = itemToDomain(externo);
		expect(i.unitario).toBe(9990);
		expect(i.total).toBe(19980);
		expect(i.bcIcms).toBe(19980);
		expect(i.icms).toBe(3596);
	});
});
