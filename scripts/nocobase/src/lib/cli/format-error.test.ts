import { describe, expect, it } from "vitest";
import { formatErrorMessage } from "./format-error";

describe("formatErrorMessage", () => {
	it("returns Error.message for Error instances", () => {
		expect(formatErrorMessage(new Error("falha na API"))).toBe("falha na API");
	});

	it("stringifies non-Error values", () => {
		expect(formatErrorMessage("texto")).toBe("texto");
		expect(formatErrorMessage(42)).toBe("42");
	});
});
