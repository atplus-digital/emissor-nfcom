import { describe, expect, it } from "bun:test";
import { desmascararDoc, mascararDoc, validarCNPJ, validarCPF } from "#/domain/fatura/cpf-cnpj";

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

describe("mascararDoc / desmascararDoc", () => {
	it("mascara CPF 11 dígitos → XXX.XXX.XXX-XX", () => {
		expect(mascararDoc("11122233344")).toBe("111.222.333-44");
	});

	it("mascara CNPJ 14 dígitos → XX.XXX.XXX/XXXX-XX", () => {
		expect(mascararDoc("31907797000139")).toBe("31.907.797/0001-39");
	});

	it("idempotente: documento já mascarado não é corrompido", () => {
		expect(mascararDoc("31.907.797/0001-39")).toBe("31.907.797/0001-39");
		expect(mascararDoc("111.222.333-44")).toBe("111.222.333-44");
	});

	it("tamanho desconhecido retorna inalterado", () => {
		expect(mascararDoc("12345")).toBe("12345");
	});

	it("desmascararDoc remove pontos/barras/traços", () => {
		expect(desmascararDoc("31.907.797/0001-39")).toBe("31907797000139");
		expect(desmascararDoc("111.222.333-44")).toBe("11122233344");
	});
});
