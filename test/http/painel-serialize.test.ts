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
	serializarEmissaoPainel,
	serializarFaturaDetalhe,
	serializarFaturaLista,
} from "#/http/routes/painel-serialize";
import type { FaturaResumo } from "#/domain/ports/atacado.port";
import { CPF_VALIDO, CNPJ_VALIDO, faturaAemitirFixture } from "./_helpers";

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
