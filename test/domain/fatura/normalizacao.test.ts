import { describe, expect, it } from "bun:test";
import { normalizarDataReferencia } from "#/domain/fatura/normalizacao";

describe("normalizarDataReferencia", () => {
	it("normaliza qualquer dia do mês para o 1º dia (chave natural)", () => {
		// SPEC-0002: 2026-08-15 e 2026-08-01 são a mesma fatura
		expect(normalizarDataReferencia("2026-08-15")).toBe("2026-08-01");
	});

	it("mantém o 1º dia inalterado", () => {
		expect(normalizarDataReferencia("2026-08-01")).toBe("2026-08-01");
	});

	it("normaliza dia de fim de mês", () => {
		expect(normalizarDataReferencia("2026-12-31")).toBe("2026-12-01");
	});
});
