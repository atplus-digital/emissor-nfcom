import { describe, expect, it } from "bun:test";
import { normalizarSituacao } from "#/modules/nfcom/translators/situacao";
import { montarPayloadEmitir, traduzirResultadoEmitir } from "#/modules/nfcom/translators/emitir";
import type { EmitirNFComInput } from "#/domain/ports/nfcom.port";
import type { Item } from "#/domain/types";

describe("normalizarSituacao", () => {
	it("mapeia AUTORIZADA → autorizada", () => {
		expect(normalizarSituacao("AUTORIZADA")).toBe("autorizada");
	});
	it("mapeia CANCELADA → cancelada", () => {
		expect(normalizarSituacao("CANCELADA")).toBe("cancelada");
	});
	it("mapeia PROCESSANDO → processando", () => {
		expect(normalizarSituacao("PROCESSANDO")).toBe("processando");
	});
	it("mapeia REJEITADA → rejeitada", () => {
		expect(normalizarSituacao("REJEITADA")).toBe("rejeitada");
	});
	it("normaliza case-insensitive (Autorizada → autorizada)", () => {
		expect(normalizarSituacao("Autorizada")).toBe("autorizada");
	});
	it("faz trim de espaços", () => {
		expect(normalizarSituacao("  AUTORIZADA  ")).toBe("autorizada");
	});
	it("lança para situação desconhecida do gateway", () => {
		expect(() => normalizarSituacao("DESCONHECIDA")).toThrow();
	});
});

describe("montarPayloadEmitir", () => {
	const itens: Item[] = [
		{
			descricao: "Serviço de telecom",
			cfop: "6102",
			cclass: "123",
			quantidade: 1,
			unitario: 15000,
			total: 15000,
			aliqIcms: 0,
			bcIcms: 0,
			icms: 0,
			incideAliquota: false,
		},
	];
	const input: EmitirNFComInput = {
		destinatario: {
			nome: "Cliente Final",
			cpfcnpj: "11122233344",
			endereco: {
				logradouro: "Rua Exemplo",
				numero: "123",
				bairro: "Centro",
				cep: "80000000",
				cidade: "Curitiba",
				uf: "PR",
			},
			uf: "PR",
			cidade: "Curitiba",
			email: "cliente@ex.com",
		},
		itens,
		cfop: "6102",
		cclass: "123",
	};

	it("NÃO inclui externalReference no payload (additionalProperties: false)", () => {
		const payload = montarPayloadEmitir(input);
		expect(payload).not.toHaveProperty("externalReference");
		expect(JSON.stringify(payload)).not.toContain("externalReference");
	});

	it("inclui destinatário, itens, cfop e cclass", () => {
		const payload = montarPayloadEmitir(input);
		expect(payload).toHaveProperty("destinatario");
		expect(payload).toHaveProperty("itens");
		expect(payload.cfop).toBe("6102");
		expect(payload.cclass).toBe("123");
	});

	it("serializa itens sem externalReference e sem campos extras", () => {
		const payload = montarPayloadEmitir(input);
		const primeiroItem = (payload.itens as unknown[])[0];
		expect(primeiroItem).not.toHaveProperty("externalReference");
	});
});

describe("traduzirResultadoEmitir", () => {
	it("mapeia pdf → pdfUrl e xml → xmlUrl, e normaliza situacao", () => {
		const resultado = traduzirResultadoEmitir({
			situacao: "AUTORIZADA",
			numero: 123,
			serie: 1,
			chave: "44digitos-de-chave-de-acesso-sefaz-ok",
			protocolo: "proto123",
			pdf: "https://gateway/pdf/123",
			xml: "https://gateway/xml/123",
		});
		expect(resultado).toEqual({
			situacao: "autorizada",
			numero: 123,
			serie: 1,
			chave: "44digitos-de-chave-de-acesso-sefaz-ok",
			protocolo: "proto123",
			pdfUrl: "https://gateway/pdf/123",
			xmlUrl: "https://gateway/xml/123",
		});
	});
	it("normaliza situacao CANCELADA → cancelada", () => {
		const resultado = traduzirResultadoEmitir({
			situacao: "CANCELADA",
			numero: 10,
			serie: 2,
			chave: "c",
			protocolo: "p",
			pdf: "pdf",
			xml: "xml",
		});
		expect(resultado.situacao).toBe("cancelada");
	});
});
