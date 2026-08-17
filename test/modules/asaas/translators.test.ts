import { describe, expect, it } from "bun:test";
import { toAsaasCustomer, toDomainCustomer } from "#/modules/asaas/translators/customer";
import {
	centsToReal,
	realToCents,
	toBoletoBody,
	toBoletoResultado,
} from "#/modules/asaas/translators/boleto";

describe("asaas translators · money", () => {
	it("centsToReal: centavos → unidade real (div 100)", () => {
		expect(centsToReal(12345)).toBe(123.45);
		expect(centsToReal(0)).toBe(0);
		expect(centsToReal(99)).toBe(0.99);
	});

	it("realToCents: unidade real → centavos (round)", () => {
		expect(realToCents(123.45)).toBe(12345);
		expect(realToCents(0.99)).toBe(99);
		expect(realToCents(0.005)).toBe(1); // arredondamento determinístico
	});

	it("round-trip cents→real→cents preserva o valor", () => {
		for (const c of [0, 1, 99, 100, 12345, 999999]) {
			expect(realToCents(centsToReal(c))).toBe(c);
		}
	});
});

describe("asaas translators · customer", () => {
	it("toDomainCustomer mapeia campos do Asaas → domínio", () => {
		const asaas = { id: "cus_abc", name: "Parceiro Ltda", email: "fin@x.com", cpfCnpj: "12345678000199" };
		expect(toDomainCustomer(asaas)).toEqual({
			id: "cus_abc",
			name: "Parceiro Ltda",
			email: "fin@x.com",
			cpfCnpj: "12345678000199",
		});
	});

	it("toAsaasCustomer mapeia domínio → Asaas (criação)", () => {
		expect(
			toAsaasCustomer({ name: "Parceiro Ltda", email: "fin@x.com", cpfCnpj: "12345678000199" }),
		).toEqual({
			name: "Parceiro Ltda",
			email: "fin@x.com",
			cpfCnpj: "12345678000199",
		});
	});
});

describe("asaas translators · boleto", () => {
	it("toBoletoBody: centavos → decimal, billingType BOLETO, externalReference passado", () => {
		expect(
			toBoletoBody({
				customerId: "cus_abc",
				valor: 12345,
				vencimento: "2026-09-10",
				externalReference: "cobranca:42",
			}),
		).toEqual({
			customer: "cus_abc",
			billingType: "BOLETO",
			value: 123.45,
			dueDate: "2026-09-10",
			externalReference: "cobranca:42",
		});
	});

	it("toBoletoResultado: id→idExterno, invoiceUrl→linkFatura", () => {
		expect(toBoletoResultado({ id: "pay_1", invoiceUrl: "https://asaas/x" })).toEqual({
			idExterno: "pay_1",
			linkFatura: "https://asaas/x",
		});
	});
});
