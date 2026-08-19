import { describe, expect, it } from "bun:test";
import { normalizarIE } from "#/domain/fiscal/ie";

describe("normalizarIE (fronteira fiscal — Defeito B)", () => {
	describe("IE isenta/ausente → undefined", () => {
		it("ISENTO (uppercase) → undefined", () => {
			expect(normalizarIE("ISENTO")).toBeUndefined();
		});
		it("isento (lowercase) → undefined (case-insensitive)", () => {
			expect(normalizarIE("isento")).toBeUndefined();
		});
		it("Isento (misto) → undefined", () => {
			expect(normalizarIE("Isento")).toBeUndefined();
		});
		it("vazio → undefined", () => {
			expect(normalizarIE("")).toBeUndefined();
		});
		it("whitespace → undefined", () => {
			expect(normalizarIE(" ")).toBeUndefined();
			expect(normalizarIE("   ")).toBeUndefined();
		});
		it("ISENTO com espaços → undefined (trim antes do check)", () => {
			expect(normalizarIE("  ISENTO  ")).toBeUndefined();
		});
		it("undefined → undefined", () => {
			expect(normalizarIE(undefined)).toBeUndefined();
		});
		it("valor não numérico arbitrário → undefined", () => {
			expect(normalizarIE("NAO-CADB")).toBeUndefined();
			expect(normalizarIE("12.345")).toBeUndefined();
		});
	});

	describe("IE numérica → valor normalizado", () => {
		it("12345678 → preservado", () => {
			expect(normalizarIE("12345678")).toBe("12345678");
		});
		it("0 é IE válida (numérico) → preservado", () => {
			expect(normalizarIE("0")).toBe("0");
		});
		it("numérica com espaços → trim e preservar", () => {
			expect(normalizarIE(" 987654 ")).toBe("987654");
		});
	});
});
