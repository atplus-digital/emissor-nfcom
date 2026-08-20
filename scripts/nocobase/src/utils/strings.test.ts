import { describe, expect, it } from "bun:test";
import { jsonToSingleQuotedString } from "./strings";

describe("strings", () => {
	describe("jsonToSingleQuotedString", () => {
		it("TC-UT-STR-009: converts JSON escaped backslash to single quote safe", () => {
			// JSON.stringify produces "\\\\" for a single backslash
			expect(jsonToSingleQuotedString('"hello\\\\world"')).toBe("hello\\world");
		});

		it("TC-UT-STR-010: converts JSON escaped double quote to unescaped double quote", () => {
			// JSON.stringify produces "\\\"" for a double quote inside the string
			expect(jsonToSingleQuotedString('"hello\\"world"')).toBe('hello"world');
		});

		it("TC-UT-STR-011: escapes single quotes for single-quoted strings", () => {
			// A string containing single quote
			expect(jsonToSingleQuotedString('"hello\'world"')).toBe("hello\\'world");
		});

		it("TC-UT-STR-012: preserves newlines", () => {
			expect(jsonToSingleQuotedString('"hello\\nworld"')).toBe("hello\\nworld");
		});

		it("TC-UT-STR-013: preserves carriage returns", () => {
			expect(jsonToSingleQuotedString('"hello\\rworld"')).toBe("hello\\rworld");
		});

		it("TC-UT-STR-014: preserves tabs", () => {
			expect(jsonToSingleQuotedString('"hello\\tworld"')).toBe("hello\\tworld");
		});

		it("TC-UT-STR-015: handles empty string", () => {
			expect(jsonToSingleQuotedString('""')).toBe("");
		});

		it("TC-UT-STR-016: handles already PascalCase string", () => {
			// A string that is already simple ASCII
			expect(jsonToSingleQuotedString('"HelloWorld"')).toBe("HelloWorld");
		});
	});
});
