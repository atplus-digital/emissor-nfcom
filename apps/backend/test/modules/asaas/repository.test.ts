import { describe, expect, it, mock } from "bun:test";
import type { AsaasPort } from "#/domain/ports/asaas.port";
import { AsaasRepository } from "#/modules/asaas/asaas.repository";
import type { AsaasClient } from "#/modules/asaas/asaas.client";

/** Fábrica de client fake — cada método é um mock do bun:test. */
function fakeClient(overrides: Partial<AsaasClient> = {}): AsaasClient {
	return {
		buscarCustomerPorDocumento: mock(() => Promise.resolve({ data: [], totalCount: 0 })),
		criarCustomer: mock(() => Promise.resolve({})),
		atualizarCustomer: mock(() => Promise.resolve({})),
		criarPayment: mock(() => Promise.resolve({})),
		consultarPaymentPorExternalReference: mock(() =>
			Promise.resolve({ data: [], totalCount: 0 }),
		),
		...overrides,
	} as AsaasClient;
}

describe("AsaasRepository · buscarCustomerPorDocumento", () => {
	it("retorna o customer quando encontra (totalCount > 0)", async () => {
		const client = fakeClient({
			buscarCustomerPorDocumento: mock(() =>
				Promise.resolve({
					data: [
						{ id: "cus_1", name: "Parceiro Ltda", email: "fin@x.com", cpfCnpj: "12345678000199" },
					],
					totalCount: 1,
				}),
			),
		});
		const repo: AsaasPort = new AsaasRepository(client);
		const c = await repo.buscarCustomerPorDocumento("12345678000199");
		expect(c).toEqual({
			id: "cus_1",
			name: "Parceiro Ltda",
			email: "fin@x.com",
			cpfCnpj: "12345678000199",
		});
	});

	it("retorna null quando não encontra (vazio)", async () => {
		const client = fakeClient();
		const repo: AsaasPort = new AsaasRepository(client);
		expect(await repo.buscarCustomerPorDocumento("00000000000")).toBeNull();
	});
});

describe("AsaasRepository · criarCustomer", () => {
	it("POSTa o body correto e retorna o customer criado", async () => {
		const client = fakeClient({
			criarCustomer: mock(() =>
				Promise.resolve({ id: "cus_new", name: "Parceiro Ltda", email: "fin@x.com", cpfCnpj: "12345678000199" }),
			),
		});
		const repo: AsaasPort = new AsaasRepository(client);
		const c = await repo.criarCustomer({
			name: "Parceiro Ltda",
			email: "fin@x.com",
			cpfCnpj: "12345678000199",
		});
		expect(c.id).toBe("cus_new");
		expect(client.criarCustomer).toHaveBeenCalledWith({
			name: "Parceiro Ltda",
			email: "fin@x.com",
			cpfCnpj: "12345678000199",
		});
	});
});

describe("AsaasRepository · atualizarCustomer", () => {
	it("PUTa o body correto e retorna o customer atualizado", async () => {
		const client = fakeClient({
			atualizarCustomer: mock(() =>
				Promise.resolve({ id: "cus_1", name: "Novo Nome", email: "novo@x.com", cpfCnpj: "12345678000199" }),
			),
		});
		const repo: AsaasPort = new AsaasRepository(client);
		const c = await repo.atualizarCustomer("cus_1", { name: "Novo Nome", email: "novo@x.com" });
		expect(c.name).toBe("Novo Nome");
		expect(client.atualizarCustomer).toHaveBeenCalledWith("cus_1", {
			name: "Novo Nome",
			email: "novo@x.com",
		});
	});
});

describe("AsaasRepository · criarBoleto", () => {
	it("converte centavos→decimal, billingType BOLETO, externalReference passado", async () => {
		const client = fakeClient({
			criarPayment: mock(() =>
				Promise.resolve({ id: "pay_1", invoiceUrl: "https://asaas/inv/1" }),
			),
		});
		const repo: AsaasPort = new AsaasRepository(client);
		const r = await repo.criarBoleto({
			customerId: "cus_1",
			valor: 12345,
			vencimento: "2026-09-10",
			externalReference: "cobranca:42",
		});
		expect(r).toEqual({ idExterno: "pay_1", linkFatura: "https://asaas/inv/1" });
		expect(client.criarPayment).toHaveBeenCalledWith({
			customer: "cus_1",
			billingType: "BOLETO",
			value: 123.45,
			dueDate: "2026-09-10",
			externalReference: "cobranca:42",
		});
	});
});

describe("AsaasRepository · consultarBoletoPorExternalReference", () => {
	it("retorna o boleto quando encontra (caso 5: consult-before-re-emit)", async () => {
		const client = fakeClient({
			consultarPaymentPorExternalReference: mock(() =>
				Promise.resolve({
					data: [{ id: "pay_1", invoiceUrl: "https://asaas/inv/1" }],
					totalCount: 1,
				}),
			),
		});
		const repo: AsaasPort = new AsaasRepository(client);
		const r = await repo.consultarBoletoPorExternalReference("cobranca:42");
		expect(r).toEqual({ idExterno: "pay_1", linkFatura: "https://asaas/inv/1" });
	});

	it("retorna null quando não encontra → caller re-emite (caso 5)", async () => {
		const client = fakeClient();
		const repo: AsaasPort = new AsaasRepository(client);
		expect(await repo.consultarBoletoPorExternalReference("cobranca:999")).toBeNull();
	});
});
