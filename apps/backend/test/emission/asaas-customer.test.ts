/** SPEC-0001 caso 16: customer já existe no Asaas com dados divergentes do CRM
 * → ATUALIZAR o customer com os dados atuais (Atacado é fonte de domínio). */
import { describe, expect, mock, test } from "bun:test";
import type { AsaasPort } from "#/domain/ports/asaas.port";
import type { AtacadoPort } from "#/domain/ports/atacado.port";
import type { NfcomPort } from "#/domain/ports/nfcom.port";
import { handleEmitCobranca } from "#/workers/emissao.worker";
import { mkDb } from "../helpers/db";

describe("SPEC-0001 caso 16 — customer divergente → atualiza", () => {
	test("customer existe com dados divergentes → atualizarCustomer com dados do CRM", async () => {
		const db = await mkDb();
		const existing = { id: "cus_1", name: "Nome Velho", email: "velho@x.com", cpfCnpj: "11122233344" };
		const asaas = {
			buscarCustomerPorDocumento: mock(() => Promise.resolve(existing)),
			atualizarCustomer: mock(() => Promise.resolve({ ...existing, name: "Nome Novo", email: "novo@x.com" })),
			criarCustomer: mock(() => Promise.reject(new Error("não deve criar"))),
			criarBoleto: mock(() => Promise.resolve({ idExterno: "pay", linkFatura: "l" })),
			consultarBoletoPorExternalReference: mock(() => Promise.resolve(null)),
		} as unknown as AsaasPort;
		const atacado = {
			atualizarStatusCobranca: mock(() => Promise.resolve()),
			registrarErro: mock(() => Promise.resolve()),
		} as unknown as AtacadoPort;

		await handleEmitCobranca(
			{ data: { cobrancaId: 200, valorTotal: 5000, documentoDevedor: "11122233344", nomeDevedor: "Nome Novo", emailDevedor: "novo@x.com", dataVencimento: "2026-09-10", notas: [] }, attemptsMade: 0, opts: {} } as any,
			{ db, asaas, atacado, nfcom: {} as unknown as NfcomPort, enqueueFilho: () => Promise.resolve() },
		);
		expect(asaas.buscarCustomerPorDocumento).toHaveBeenCalledWith("11122233344");
		expect(asaas.atualizarCustomer).toHaveBeenCalledWith("cus_1", { name: "Nome Novo", email: "novo@x.com" });
		expect(asaas.criarCustomer).toHaveBeenCalledTimes(0);
	});

	test("customer não existe → cria", async () => {
		const db = await mkDb();
		const asaas = {
			buscarCustomerPorDocumento: mock(() => Promise.resolve(null)),
			criarCustomer: mock(() => Promise.resolve({ id: "cus_new", name: "N", email: "e", cpfCnpj: "1" })),
			atualizarCustomer: mock(() => Promise.reject(new Error("não deve atualizar"))),
			criarBoleto: mock(() => Promise.resolve({ idExterno: "pay", linkFatura: "l" })),
			consultarBoletoPorExternalReference: mock(() => Promise.resolve(null)),
		} as unknown as AsaasPort;
		const atacado = { atualizarStatusCobranca: mock(() => Promise.resolve()), registrarErro: mock(() => Promise.resolve()) } as unknown as AtacadoPort;
		await handleEmitCobranca(
			{ data: { cobrancaId: 201, valorTotal: 5000, documentoDevedor: "1", nomeDevedor: "N", emailDevedor: "e", dataVencimento: "2026-09-10", notas: [] }, attemptsMade: 0, opts: {} } as any,
			{ db, asaas, atacado, nfcom: {} as unknown as NfcomPort, enqueueFilho: () => Promise.resolve() },
		);
		expect(asaas.criarCustomer).toHaveBeenCalledTimes(1);
		expect(asaas.atualizarCustomer).toHaveBeenCalledTimes(0);
	});
});
