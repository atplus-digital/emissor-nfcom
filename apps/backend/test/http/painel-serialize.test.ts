/**
 * Serialização de UI do painel — `src/http/routes/painel-serialize.ts`.
 *
 * Fronteira de exibição (ADR-0004): a única camada onde **centavos → reais**
 * (centavos/100) e **documento limpo → mascarado** acontecem. Os status seguem
 * os enums do domínio (o front resolve a cor/ícone).
 */
import { describe, expect, test } from "bun:test";
import {
	mascararDoc,
	serializarClienteLista,
	serializarEmissaoPainel,
	serializarFaturaDetalhe,
	serializarFaturaLista,
	serializarParceiroDetalhe,
	serializarParceiroLista,
	serializarPreparo,
	type PreparoCru,
} from "#/http/routes/painel-serialize";
import type { FaturaResumo } from "#/domain/ports/atacado.port";
import {
	CPF_VALIDO,
	CNPJ_VALIDO,
	clienteFixture,
	faturaAemitirFixture,
	parceiroFixture,
	parceiroResumoFixture,
} from "./_helpers";

const resumoFixture: FaturaResumo = {
	id: 101,
	parceiroId: 42,
	dataReferencia: "2026-08-01",
	dataVencimento: "2026-09-10",
	valorTotal: 10000, // 100,00 em reais
	tipoFaturamento: "parceiro",
	status: "a-emitir",
	cobrancasCount: 2,
};

describe("serializarFaturaLista", () => {
	test("converte centavos → reais (10000 → 100) e mantém cobrancasCount", () => {
		const [item] = serializarFaturaLista([resumoFixture]);
		expect(item).toEqual({
			id: 101,
			parceiroId: 42,
			dataReferencia: "2026-08-01",
			dataVencimento: "2026-09-10",
			valorTotal: 100,
			tipoFaturamento: "parceiro",
			status: "a-emitir",
			cobrancasCount: 2,
		});
	});

	test("lista vazia → []", () => {
		expect(serializarFaturaLista([])).toEqual([]);
	});
});

describe("serializarFaturaDetalhe", () => {
	test("mascara CNPJ do devedor (11444777000161 → 11.444.777/0001-61)", () => {
		const f = faturaAemitirFixture();
		const d = serializarFaturaDetalhe(f);
		expect(d.cobrancas[0].documentoDevedor).toBe("11.444.777/0001-61");
	});

	test("mascara CPF da nota (52998224725 → 529.982.247-25)", () => {
		const f = faturaAemitirFixture();
		const d = serializarFaturaDetalhe(f);
		expect(d.cobrancas[0].notas[0].cpfcnpj).toBe("529.982.247-25");
	});

	test("centavos → reais em total da fatura, cobrança e nota", () => {
		const f = faturaAemitirFixture(); // fatura 10000 / cobrança 10000 / nota 10000
		const d = serializarFaturaDetalhe(f);
		expect(d.valorTotal).toBe(100);
		expect(d.cobrancas[0].valorTotal).toBe(100);
		expect(d.cobrancas[0].notas[0].total).toBe(100);
	});

	test("mantém status do domínio e metadados da árvore", () => {
		const f = faturaAemitirFixture({ status: "emitindo" });
		const d = serializarFaturaDetalhe(f);
		expect(d.id).toBe(101);
		expect(d.parceiroId).toBe(42);
		expect(d.status).toBe("emitindo");
		expect(d.cobrancas[0].id).toBe(456);
		expect(d.cobrancas[0].status).toBe("a-emitir");
		expect(d.cobrancas[0].notas[0].statusInterno).toBe("a-emitir");
	});
});

describe("serializarEmissaoPainel", () => {
	test("estrutura: faturaId, status, cobranças com notas {id,situacao,chave,protocolo}, erros", () => {
		const f = faturaAemitirFixture({ status: "erro" });
		f.cobrancas[0].id = 456;
		f.cobrancas[0].notas[0].id = 7;
		f.cobrancas[0].notas[0].situacao = "rejeitada";
		f.cobrancas[0].notas[0].chave = "chave44digitos";
		f.cobrancas[0].notas[0].protocolo = "12345";
		f.cobrancas[0].linkFatura = "http://boleto";
		const erros = [
			{ id: 1, cobrancaId: 456, erro: "BOLETO", mensagem: "customer inválido" },
		];
		const out = serializarEmissaoPainel(f, erros as any);
		expect(out.faturaId).toBe(101);
		expect(out.status).toBe("erro");
		expect(out.cobrancas[0]).toMatchObject({
			id: 456,
			status: "a-emitir",
			boletoUrl: "http://boleto",
			notas: [{ id: 7, situacao: "rejeitada", chave: "chave44digitos", protocolo: "12345" }],
		});
		expect(out.erros[0]).toMatchObject({
			id: 1,
			cobrancaId: 456,
			erro: "BOLETO",
			mensagem: "customer inválido",
		});
	});
});

describe("mascararDoc", () => {
	test("CPF (11 dígitos) → 000.000.000-00", () => {
		expect(mascararDoc(CPF_VALIDO)).toBe("529.982.247-25");
	});

	test("CNPJ (14 dígitos) → 00.000.000/0000-00", () => {
		expect(mascararDoc(CNPJ_VALIDO)).toBe("11.444.777/0001-61");
	});

	test("documento já mascarado ou de outro tamanho → não altera", () => {
		expect(mascararDoc("11.444.777/0001-61")).toBe("11.444.777/0001-61");
		expect(mascararDoc("123")).toBe("123");
	});
});

describe("serializarParceiroLista", () => {
	test("CNPJ limpo → mascarado; fantasia ausente → undefined", () => {
		const [item, outro] = serializarParceiroLista([
			parceiroResumoFixture(),
			parceiroResumoFixture({ id: 7, razaoSocial: "Outro", fantasia: undefined }),
		]);
		expect(item).toEqual({
			id: 42,
			razaoSocial: "Parceiro Ltda",
			fantasia: "Parceiro",
			cnpj: "11.444.777/0001-61",
		});
		expect(outro.fantasia).toBeUndefined();
	});

	test("lista vazia → []", () => {
		expect(serializarParceiroLista([])).toEqual([]);
	});
});

describe("serializarParceiroDetalhe", () => {
	test("detalhe completo (cnpj mascarado, endereço, ie, diaVencimento)", () => {
		const d = serializarParceiroDetalhe(parceiroFixture());
		expect(d).toEqual({
			id: 42,
			razaoSocial: "Parceiro Ltda",
			fantasia: "Parceiro",
			cnpj: "11.444.777/0001-61",
			emailFaturamento: "fin@parceiro.com",
			diaVencimento: 10,
			ie: "123",
			endereco: {
				logradouro: "Rua Exemplo",
				numero: "123",
				bairro: "Centro",
				cep: "80000000",
				cidade: "Curitiba",
				uf: "PR",
			},
		});
	});

	test("parceiro sem IE → ie undefined", () => {
		const d = serializarParceiroDetalhe(parceiroFixture({ ie: undefined }));
		expect(d.ie).toBeUndefined();
	});
});

describe("serializarClienteLista", () => {
	test("cpfcnpj mascarado e linhas com unitário em reais (centavos/100)", () => {
		const [item] = serializarClienteLista([
			clienteFixture({ linhas: [{ planoId: 100, descricao: "Plano 100Mbps", unitario: 10000, quantidade: 2 }] }),
		]);
		expect(item.cpfcnpj).toBe("529.982.247-25");
		expect(item.linhas).toEqual([
			{ planoId: 100, descricao: "Plano 100Mbps", unitario: 100, quantidade: 2 },
		]);
		expect(item.endereco.cidade).toBe("Curitiba");
	});

	test("lista vazia → []", () => {
		expect(serializarClienteLista([])).toEqual([]);
	});
});

describe("serializarPreparo", () => {
	test("centavos → reais e docs limpos → mascarados (contrato do painel)", () => {
		const cru: PreparoCru = {
			faturaId: 101,
			status: "a-emitir",
			dataReferencia: "2026-08-01",
			dataVencimento: "2026-09-10",
			valorTotal: 10000,
			tipoFaturamento: "parceiro",
			cobrancas: [
				{
					id: 456,
					valorTotal: 10000,
					nomeDevedor: "Parceiro Ltda",
					documentoDevedor: CNPJ_VALIDO,
					emailDevedor: "fin@parceiro.com",
					status: "a-emitir",
					dataVencimento: "2026-09-10",
					descricao: "1x Plano 100Mbps = R$ 100,00\nAgo/2026",
					notas: [
						{
							id: 7,
							nome: "Parceiro Ltda",
							cpfcnpj: CNPJ_VALIDO,
							email: "fin@parceiro.com",
							telefone: "41 3333-0000",
							endereco: {
								logradouro: "Rua Exemplo",
								numero: "123",
								bairro: "Centro",
								cep: "80000000",
								cidade: "Curitiba",
								uf: "PR",
							},
							total: 10000,
							cobrancaId: 456,
							status: "a-emitir",
							itens: [
								{
									descricao: "Plano 100Mbps",
									cfop: "7309",
									cclass: "1",
									quantidade: 1,
									unitario: 10000,
									total: 10000,
									aliqIcms: 0.18,
									bcIcms: 10000,
									icms: 1800,
									incideAliquota: true,
								},
							],
						},
					],
				},
			],
		};
		const out = serializarPreparo(cru);
		expect(out.faturaId).toBe(101);
		expect(out.valorTotal).toBe(100);
		expect(out.cobrancas).toHaveLength(1);
		expect(out.cobrancas[0].valorTotal).toBe(100);
		expect(out.cobrancas[0].documentoDevedor).toBe("11.444.777/0001-61");
		expect(out.cobrancas[0].dataVencimento).toBe("2026-09-10");
		expect(out.cobrancas[0].descricao).toBe("1x Plano 100Mbps = R$ 100,00\nAgo/2026");
		expect(out.cobrancas[0].notas[0]).toEqual({
			id: 7,
			nome: "Parceiro Ltda",
			cpfcnpj: "11.444.777/0001-61",
			email: "fin@parceiro.com",
			telefone: "41 3333-0000",
			endereco: {
				logradouro: "Rua Exemplo",
				numero: "123",
				bairro: "Centro",
				cep: "80000000",
				cidade: "Curitiba",
				uf: "PR",
			},
			total: 100,
			cobrancaId: 456,
			status: "a-emitir",
			itens: [
				{
					item: undefined,
					codigo: undefined,
					descricao: "Plano 100Mbps",
					cfop: "7309",
					cclass: "1",
					quantidade: 1,
					unitario: 100,
					total: 100,
					aliqIcms: 0.18,
					bcIcms: 100,
					icms: 18,
					incideAliquota: true,
				},
			],
		});
	});
});
