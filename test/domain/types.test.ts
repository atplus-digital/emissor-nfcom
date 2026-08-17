/**
 * Testes de tipos de domínio (ADR-0004) — guardam o contrato de tipos que
 * agregados (Fase 2b) e módulos (Fase 3) consomem. Centavos inteiros, documentos
 * limpos, sem tipos externos vazando.
 */
import { describe, it, expect } from "bun:test";
import type {
	TipoFaturamento,
	StatusFatura,
	StatusCobranca,
	StatusInternoNota,
	SituacaoNota,
	Endereco,
	Item,
	Nota,
	Cobranca,
	Fatura,
	Parceiro,
	Linha,
	Cliente,
	Plano,
	EventoWebhook,
	TipoErro,
} from "#/domain/types";

describe("tipos de domínio", () => {
	it("TipoFaturamento aceita os 4 valores canônicos", () => {
		const t: TipoFaturamento[] = [
			"parceiro",
			"via-parceiro",
			"cofaturamento",
			"cliente-final",
		];
		expect(t).toHaveLength(4);
	});

	it("enums de status cobrem os valores do ciclo de emissão", () => {
		const sf: StatusFatura = "a-emitir";
		const sc: StatusCobranca = "emitida";
		const sn: StatusInternoNota = "erro";
		const sit: SituacaoNota = "autorizada";
		expect([sf, sc, sn, sit]).toHaveLength(4);
	});

	it("Endereco tem todos os campos exigidos pelo MOC NFCom", () => {
		const e: Endereco = {
			logradouro: "Rua X",
			numero: "123",
			bairro: "Centro",
			cep: "80000000",
			cidade: "Curitiba",
			uf: "PR",
		};
		expect(e.uf).toBe("PR");
	});

	it("Item usa centavos inteiros para unitario/total/bcIcms/icms", () => {
		const i: Item = {
			codigo: "SVC1",
			descricao: "Serviço",
			cfop: "6102",
			cclass: "010101",
			quantidade: 1,
			unitario: 12345,
			total: 12345,
			aliqIcms: 0,
			bcIcms: 12345,
			icms: 0,
			incideAliquota: false,
		};
		expect(i.unitario).toBe(12345);
		expect(i.total).toBe(12345);
	});

	it("Nota carrega endereco do destinatário + status duplo", () => {
		const n: Nota = {
			cobrancaId: 456,
			nome: "Cliente",
			cpfcnpj: "11122233344",
			endereco: {
				logradouro: "R",
				numero: "1",
				bairro: "B",
				cep: "80000000",
				cidade: "C",
				uf: "PR",
			},
			uf: "PR",
			cidade: "C",
			statusInterno: "a-emitir",
			total: 12345,
			itens: [],
		};
		expect(n.statusInterno).toBe("a-emitir");
		expect(n.situacao).toBeUndefined();
	});

	it("Cobranca agrupa notas e usa centavos", () => {
		const c: Cobranca = {
			faturaId: 1,
			valorTotal: 10000,
			nomeDevedor: "Parceiro",
			documentoDevedor: "12345678000199",
			emailDevedor: "fin@p.com",
			status: "a-emitir",
			dataVencimento: "2026-09-10",
			notas: [],
		};
		expect(c.valorTotal).toBe(10000);
	});

	it("Fatura referencia parceiro + dataReferencia normalizada", () => {
		const f: Fatura = {
			parceiroId: 42,
			dataReferencia: "2026-08-01",
			dataVencimento: "2026-09-10",
			valorTotal: 10000,
			tipoFaturamento: "cofaturamento",
			status: "a-emitir",
			cobrancas: [],
		};
		expect(f.dataReferencia).toBe("2026-08-01");
	});

	it("Parceiro tem diaVencimento numérico + endereco", () => {
		const p: Parceiro = {
			id: 42,
			razaoSocial: "Parceiro Ltda",
			cnpj: "12345678000199",
			emailFaturamento: "fin@p.com",
			diaVencimento: 10,
			endereco: {
				logradouro: "R",
				numero: "1",
				bairro: "B",
				cep: "80000000",
				cidade: "C",
				uf: "PR",
			},
		};
		expect(p.diaVencimento).toBe(10);
	});

	it("Cliente tem linhas com planoId + unitario em centavos", () => {
		const cli: Cliente = {
			id: 7,
			nome: "Cliente",
			cpfcnpj: "11122233344",
			linhas: [{ planoId: 1, descricao: "Plano", unitario: 5000, quantidade: 1 }],
		};
		expect(cli.linhas[0].unitario).toBe(5000);
	});

	it("Plano.preco é centavos", () => {
		const pl: Plano = { id: 1, descricao: "Plano", preco: 5000 };
		expect(pl.preco).toBe(5000);
	});

	it("EventoWebhook tem eventoId + alvo + erros tipados", () => {
		const ev: EventoWebhook = {
			eventoId: "evt-1",
			faturaId: 1,
			tipo: "fatura.status",
			alvo: { faturaId: 1 },
			estado: "emitida",
			erros: [{ cobrancaId: 9, tipo: "RETRYABLE", mensagem: "x" }],
			timestamp: "2026-08-17T12:00:00Z",
		};
		const te: TipoErro = "FATAL";
		expect(ev.eventoId).toBe("evt-1");
		expect(te).toBe("FATAL");
	});

	it("Linha sem plano/preço zero é representável (descarte é regra de cálculo, não de tipo)", () => {
		const l: Linha = { planoId: 0, descricao: "", unitario: 0, quantidade: 0 };
		expect(l.unitario).toBe(0);
	});
});
