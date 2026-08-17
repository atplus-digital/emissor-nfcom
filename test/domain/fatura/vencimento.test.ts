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

	it("clampa dia 31 para fevereiro não-bissexto (C2): ref 2026-01 → 2026-02-28", () => {
		expect(calcularDataVencimento("2026-01-15", 31)).toBe("2026-02-28");
	});

	it("clampa dia 31 para fevereiro bissexto (C2): ref 2024-01 → 2024-02-29", () => {
		expect(calcularDataVencimento("2024-01-15", 31)).toBe("2024-02-29");
	});

	it("clampa dia 31 para mês de 30 dias (C2): ref 2026-03 → 2026-04-30", () => {
		expect(calcularDataVencimento("2026-03-15", 31)).toBe("2026-04-30");
	});

	it("não clampa dia 31 em mês de 31 dias (C2): ref 2026-07 → 2026-08-31", () => {
		expect(calcularDataVencimento("2026-07-15", 31)).toBe("2026-08-31");
	});

	it("clampa dia 30 em fevereiro (C2): ref 2026-01, dia 30 → 2026-02-28", () => {
		expect(calcularDataVencimento("2026-01-15", 30)).toBe("2026-02-28");
	});
});
