import { describe, expect, it } from "bun:test";
import { validarCNPJ, validarCPF } from "#/domain/fatura/cpf-cnpj";

describe("validarCPF", () => {
	it("aceita CPF válido com dígito correto", () => {
		// CPF gerado válido (529.982.247-25 — conhecido válido)
		expect(validarCPF("52998224725")).toBe(true);
	});

	it("aceita CPF válido mascarado (desmascara antes)", () => {
		expect(validarCPF("529.982.247-25")).toBe(true);
	});

	it("rejeita CPF com dígito verificador incorreto", () => {
		expect(validarCPF("52998224726")).toBe(false);
	});

	it("rejeita CPF com todos os dígitos iguais (000.000.000-00)", () => {
		expect(validarCPF("00000000000")).toBe(false);
	});

	it("rejeita CPF muito curto", () => {
		expect(validarCPF("123456")).toBe(false);
	});
});

describe("validarCNPJ", () => {
	it("aceita CNPJ válido com dígito correto", () => {
		// 11.444.777/0001-61 — conhecido válido
		expect(validarCNPJ("11444777000161")).toBe(true);
	});

	it("aceita CNPJ válido mascarado", () => {
		expect(validarCNPJ("11.444.777/0001-61")).toBe(true);
	});

	it("rejeita CNPJ com dígito verificador incorreto", () => {
		expect(validarCNPJ("11444777000162")).toBe(false);
	});

	it("rejeita CNPJ com todos os dígitos iguais", () => {
		expect(validarCNPJ("11111111111111")).toBe(false);
	});
});
