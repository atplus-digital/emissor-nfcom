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
	};

	it("NÃO inclui externalReference no payload (additionalProperties: false)", () => {
		const payload = montarPayloadEmitir(input);
		expect(payload).not.toHaveProperty("externalReference");
		expect(JSON.stringify(payload)).not.toContain("externalReference");
	});

	it("é achatado no topo — sem destinatario aninhado nem cfop/cclass no topo", () => {
		const payload = montarPayloadEmitir(input);
		// swagger `ApiNFComEmitir` é flat (additionalProperties:false):
		expect(payload).not.toHaveProperty("destinatario");
		expect(payload).not.toHaveProperty("cfop");
		expect(payload).not.toHaveProperty("cclass");
		// endereço e dados do destinatário sobem ao topo (flat):
		expect(payload.nome).toBe(input.destinatario.nome);
		// cpfcnpj é mascarado na fronteira do gateway NFCom (Vigo roteia
		// CPF/CNPJ pela formatação, não pelo comprimento): 11 dígitos → CPF.
		expect(payload.cpfcnpj).toBe("111.222.333-44");
		expect(payload.endereco).toBe(input.destinatario.endereco.logradouro);
		expect(payload.endereco_numero).toBe(input.destinatario.endereco.numero);
		expect(payload.bairro).toBe(input.destinatario.endereco.bairro);
		expect(payload.cidade).toBe(input.destinatario.endereco.cidade);
		expect(payload.uf).toBe(input.destinatario.endereco.uf);
		expect(payload.cep).toBe(input.destinatario.endereco.cep);
		expect(payload.email).toBe(input.destinatario.email);
	});

	it("move cfop/cclass para DENTRO de cada item", () => {
		const payload = montarPayloadEmitir(input);
		expect(payload.itens).toHaveLength(1);
		const primeiroItem = payload.itens[0];
		expect(primeiroItem.cfop).toBe("6102");
		expect(primeiroItem.cclass).toBe("123");
	});

	it("serializa itens com os campos exatos do swagger (sem aliq_icms/icms/incide_aliquota/codigo)", () => {
		const payload = montarPayloadEmitir(input);
		const primeiroItem = payload.itens[0];
		expect(primeiroItem).not.toHaveProperty("externalReference");
		expect(primeiroItem).not.toHaveProperty("codigo");
		expect(primeiroItem).not.toHaveProperty("aliq_icms");
		expect(primeiroItem).not.toHaveProperty("icms");
		expect(primeiroItem).not.toHaveProperty("incide_aliquota");
		expect(primeiroItem).toHaveProperty("descricao", "Serviço de telecom");
		expect(primeiroItem).toHaveProperty("quantidade", 1);
		expect(primeiroItem).toHaveProperty("bc_icms", 0);
	});

	it("converte centavos (domínio) para reais (gateway) em unitario/total/bc_icms", () => {
		const payload = montarPayloadEmitir({
			...input,
			itens: [
				{
					descricao: "Serviço de telecom",
					cfop: "6102",
					cclass: "123",
					quantidade: 2,
					unitario: 15000,
					total: 30000,
					aliqIcms: 18,
					bcIcms: 30000,
					icms: 5400,
					incideAliquota: true,
				},
			],
		});
		const primeiroItem = payload.itens[0];
		expect(primeiroItem.unitario).toBe(150.0);
		expect(primeiroItem.total).toBe(300.0);
		expect(primeiroItem.bc_icms).toBe(300.0);
	});

	it("mascara CNPJ (14 dígitos) — regressão do bug do gateway NFCom", () => {
		// O gateway NFCom (Vigo) roteia o elemento XML CPF vs CNPJ pela
		// presença dos caracteres de formatação, NÃO pelo comprimento. Um
		// CNPJ limpo (14 dígitos) é lido como CPF (TCpf aceita só 11) e
		// rejeitado com "Falha no schema XML". O translator deve mascarar.
		const payload = montarPayloadEmitir({
			...input,
			destinatario: { ...input.destinatario, cpfcnpj: "31907797000139" },
		});
		expect(payload.cpfcnpj).toBe("31.907.797/0001-39");
		// já mascarado no input não é corrompido
		const mascarado = montarPayloadEmitir({
			...input,
			destinatario: { ...input.destinatario, cpfcnpj: "31.907.797/0001-39" },
		});
		expect(mascarado.cpfcnpj).toBe("31.907.797/0001-39");
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
