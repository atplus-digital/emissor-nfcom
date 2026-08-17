import { describe, expect, it } from "bun:test";
import { calcularDataVencimento, DIA_VENCIMENTO_DEFAULT } from "#/domain/fatura/vencimento";

describe("calcularDataVencimento", () => {
	it("usa o dia do parceiro no mês seguinte ao da referência", () => {
		// ref 2026-08-01 → vence 2026-09-15 (dia 15 do parceiro)
		expect(calcularDataVencimento("2026-08-01", 15)).toBe("2026-09-15");
	});

	it("usa o dia default 10 quando o parceiro não define (SPEC-0002 caso 10)", () => {
		expect(calcularDataVencimento("2026-08-01")).toBe("2026-09-10");
		expect(DIA_VENCIMENTO_DEFAULT).toBe(10);
	});

	it("aceita referência em qualquer dia do mês (normaliza para o 1º)", () => {
		// ref 2026-08-15 → vence 2026-09-10
		expect(calcularDataVencimento("2026-08-15")).toBe("2026-09-10");
	});

	it("faz rollover de ano: dezembro → janeiro do ano seguinte", () => {
		// ref 2026-12-31 → vence 2027-01-10
		expect(calcularDataVencimento("2026-12-31")).toBe("2027-01-10");
	});

	it("faz rollover de ano com dia do parceiro customizado", () => {
		expect(calcularDataVencimento("2026-12-15", 5)).toBe("2027-01-05");
	});
});
