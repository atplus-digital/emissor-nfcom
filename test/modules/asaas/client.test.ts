import { describe, expect, it, mock } from "bun:test";
import { AsaasApiError, createAsaasClient } from "#/modules/asaas/asaas.client";

/** fetch fake — retorna Response-like com status + json. */
function fakeFetch(response: { status: number; body: unknown }) {
	return mock((_url: string, _init?: RequestInit) =>
		Promise.resolve({
			ok: response.status >= 200 && response.status < 300,
			status: response.status,
			json: () => Promise.resolve(response.body),
		}),
	) as unknown as typeof fetch;
}

/** Opts fixos p/ não tocar em `env` (que valida chaves reais). */
const NO_ENV_OPTS = { baseUrl: "https://asaas.test", apiKey: "test-key" } as const;

describe("asaas.client · buscarCustomerPorDocumento", () => {
	it("GET /v3/customers?cpfCnpj= e retorna o envelope {data,totalCount}", async () => {
		const f = fakeFetch({
			status: 200,
			body: {
				data: [{ id: "cus_1", name: "X", email: "x@x", cpfCnpj: "111" }],
				totalCount: 1,
			},
		});
		const client = createAsaasClient({ fetchImpl: f, ...NO_ENV_OPTS });
		const r = await client.buscarCustomerPorDocumento("111");
		expect(r.totalCount).toBe(1);
		expect(r.data[0].id).toBe("cus_1");
		const url = (f as unknown as ReturnType<typeof mock>).mock.calls[0][0] as string;
		expect(url).toContain("/v3/customers?cpfCnpj=111");
	});

	it("envia o header access_token", async () => {
		const f = fakeFetch({ status: 200, body: { data: [], totalCount: 0 } });
		const client = createAsaasClient({ fetchImpl: f, ...NO_ENV_OPTS });
		await client.buscarCustomerPorDocumento("111");
		const init = (f as unknown as ReturnType<typeof mock>).mock.calls[0][1] as RequestInit;
		const headers = init.headers as Record<string, string>;
		expect(headers.access_token).toBeTruthy();
	});
});

describe("asaas.client · criarCustomer", () => {
	it("POST /v3/customers com body JSON", async () => {
		const f = fakeFetch({ status: 200, body: { id: "cus_new", name: "X", email: "x", cpfCnpj: "111" } });
		const client = createAsaasClient({ fetchImpl: f, ...NO_ENV_OPTS });
		const r = await client.criarCustomer({ name: "X", email: "x", cpfCnpj: "111" });
		expect(r.id).toBe("cus_new");
		const init = (f as unknown as ReturnType<typeof mock>).mock.calls[0][1] as RequestInit;
		expect(init.method).toBe("POST");
		expect(JSON.parse(init.body as string)).toEqual({ name: "X", email: "x", cpfCnpj: "111" });
	});
});

describe("asaas.client · atualizarCustomer", () => {
	it("PUT /v3/customers/{id}", async () => {
		const f = fakeFetch({ status: 200, body: { id: "cus_1", name: "Novo", email: "n", cpfCnpj: "111" } });
		const client = createAsaasClient({ fetchImpl: f, ...NO_ENV_OPTS });
		await client.atualizarCustomer("cus_1", { name: "Novo" });
		const url = (f as unknown as ReturnType<typeof mock>).mock.calls[0][0] as string;
		const init = (f as unknown as ReturnType<typeof mock>).mock.calls[0][1] as RequestInit;
		expect(url).toContain("/v3/customers/cus_1");
		expect(init.method).toBe("PUT");
	});
});

describe("asaas.client · criarPayment", () => {
	it("POST /v3/payments", async () => {
		const f = fakeFetch({ status: 200, body: { id: "pay_1", invoiceUrl: "https://asaas/1" } });
		const client = createAsaasClient({ fetchImpl: f, ...NO_ENV_OPTS });
		const r = await client.criarPayment({
			customer: "cus_1",
			billingType: "BOLETO",
			value: 123.45,
			dueDate: "2026-09-10",
			externalReference: "cobranca:42",
		});
		expect(r.id).toBe("pay_1");
		expect(r.invoiceUrl).toBe("https://asaas/1");
	});
});

describe("asaas.client · consultarPaymentPorExternalReference", () => {
	it("GET /v3/payments?externalReference=", async () => {
		const f = fakeFetch({ status: 200, body: { data: [{ id: "pay_1", invoiceUrl: "u" }], totalCount: 1 } });
		const client = createAsaasClient({ fetchImpl: f, ...NO_ENV_OPTS });
		const r = await client.consultarPaymentPorExternalReference("cobranca:42");
		expect(r.totalCount).toBe(1);
		const url = (f as unknown as ReturnType<typeof mock>).mock.calls[0][0] as string;
		expect(url).toContain("/v3/payments?externalReference=cobranca%3A42");
	});
});

describe("asaas.client · erros", () => {
	it("lança AsaasApiError com o payload errors[] em status não-2xx", async () => {
		const f = fakeFetch({
			status: 400,
			body: { errors: [{ code: "invalid", description: "bad value" }] },
		});
		const client = createAsaasClient({ fetchImpl: f, ...NO_ENV_OPTS });
		expect(async () => {
			await client.criarCustomer({ name: "X", email: "x", cpfCnpj: "111" });
		}).toThrow(); // bun:test async toThrow
		try {
			await client.criarCustomer({ name: "X", email: "x", cpfCnpj: "111" });
		} catch (e) {
			expect(e).toBeInstanceOf(AsaasApiError);
			expect((e as AsaasApiError).status).toBe(400);
			expect((e as AsaasApiError).errors).toHaveLength(1);
		}
	});
});
