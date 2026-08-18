/**
 * Testes das portas de domínio (ADR-0004) — guardam o contrato que módulos
 * (Fase 3) implementam e agregados (Fase 2b) consomem. Mock satisfaz cada
 * interface; asserção de presença de método protege contra drift de contrato.
 */
import { describe, it, expect } from "bun:test";
import type { AtacadoPort } from "#/domain/ports/atacado.port";
import type { AsaasPort, AsaasCustomer } from "#/domain/ports/asaas.port";
import type {
	NfcomPort,
	EmitirNFComInput,
	EmitirNFComResultado,
	NFComListaItem,
} from "#/domain/ports/nfcom.port";
import type { QueuePort } from "#/domain/ports/queue.port";
import type { EventoWebhook } from "#/domain/types";

describe("portas de domínio (contrato que módulos implementam)", () => {
	it("AtacadoPort expõe leitura + árvore + status + erro", () => {
		const mock: AtacadoPort = {
			buscarParceiroPorId: async () => ({
				id: 1,
				razaoSocial: "P",
				cnpj: "x",
				emailFaturamento: "e",
				diaVencimento: 10,
				endereco: {
					logradouro: "",
					numero: "",
					bairro: "",
					cep: "",
					cidade: "",
					uf: "",
				},
			}),
			buscarClientesAtivosPorParceiro: async () => [],
			buscarPlanosDeServico: async () => [],
			buscarFaturaPorChave: async () => null,
			criarFatura: async () => ({ id: 1 }),
			criarCobranca: async () => ({ id: 2 }),
			criarNota: async () => ({ id: 3 }),
			criarItem: async () => {},
			removerArvore: async () => {},
			atualizarStatusFatura: async () => {},
			atualizarStatusCobranca: async () => {},
			atualizarStatusNota: async () => {},
			registrarErro: async () => {},
		};
		const methods = [
			"buscarParceiroPorId",
			"buscarClientesAtivosPorParceiro",
			"buscarPlanosDeServico",
			"buscarFaturaPorChave",
			"criarFatura",
			"criarCobranca",
			"criarNota",
			"criarItem",
			"removerArvore",
			"atualizarStatusFatura",
			"atualizarStatusCobranca",
			"atualizarStatusNota",
			"registrarErro",
		];
		for (const m of methods) expect(typeof (mock as never)[m]).toBe("function");
	});

	it("AsaasPort expõe customer + boleto + consulta por externalReference", () => {
		const cust: AsaasCustomer = {
			id: "cus_1",
			name: "Parceiro",
			email: "fin@p.com",
			cpfCnpj: "12345678000199",
		};
		expect(cust.id).toBe("cus_1");
		const mock: AsaasPort = {
			buscarCustomerPorDocumento: async () => null,
			criarCustomer: async () => cust,
			atualizarCustomer: async () => cust,
			criarBoleto: async () => ({ idExterno: "pay_1", linkFatura: "https://l" }),
			consultarBoletoPorExternalReference: async () => null,
		};
		const methods = [
			"buscarCustomerPorDocumento",
			"criarCustomer",
			"atualizarCustomer",
			"criarBoleto",
			"consultarBoletoPorExternalReference",
		];
		for (const m of methods) expect(typeof (mock as never)[m]).toBe("function");
	});

	it("NfcomPort expõe autenticar + emitir + consultarLista (sem externalReference)", () => {
		const input: EmitirNFComInput = {
			destinatario: {
				nome: "C",
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
			},
			itens: [],
		};
		// sem campo de referência própria (ApiNFComEmitir additionalProperties:false)
		expect((input as Record<string, unknown>).externalReference).toBeUndefined();
		const resultado: EmitirNFComResultado = {
			situacao: "autorizada",
			numero: 1,
			serie: 1,
			chave: "chave",
			protocolo: "proto",
			pdfUrl: "https://pdf",
			xmlUrl: "https://xml",
		};
		expect(resultado.situacao).toBe("autorizada");
		const item: NFComListaItem = {
			chave: "chave",
			situacao: "AUTORIZADA",
			protocolo: "p",
		};
		expect(item.chave).toBe("chave");
		const mock: NfcomPort = {
			autenticar: async () => "bearer",
			emitirNFCom: async () => resultado,
			consultarLista: async () => [item],
		};
		for (const m of ["autenticar", "emitirNFCom", "consultarLista"]) {
			expect(typeof (mock as never)[m]).toBe("function");
		}
	});

	it("QueuePort expõe enfileirarEmissaoFatura + enfileirarWebhook", async () => {
		const ev: EventoWebhook = {
			eventoId: "e",
			faturaId: 1,
			tipo: "fatura.status",
			alvo: { faturaId: 1 },
			estado: "emitida",
			timestamp: "2026-08-17T12:00:00Z",
		};
		const mock: QueuePort = {
			enfileirarEmissaoFatura: async () => ({ jobId: "j-1" }),
			enfileirarWebhook: async () => {},
		};
		const r = await mock.enfileirarEmissaoFatura(1);
		expect(r.jobId).toBe("j-1");
		expect(typeof mock.enfileirarWebhook).toBe("function");
		await mock.enfileirarWebhook(ev);
	});
});
