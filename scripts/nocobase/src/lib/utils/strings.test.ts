import { describe, expect, it } from "vitest";
import {
	escapeString,
	jsonToSingleQuotedString,
	serializePayloadData,
} from "./strings";

describe("strings", () => {
	describe("escapeString", () => {
		it("TC-UT-STR-001: escapes backslashes", () => {
			expect(escapeString("hello\\world")).toBe("hello\\\\world");
		});

		it("TC-UT-STR-002: escapes double quotes", () => {
			expect(escapeString('hello"world')).toBe('hello\\"world');
		});

		it("TC-UT-STR-003: escapes newlines", () => {
			expect(escapeString("hello\nworld")).toBe("hello\\nworld");
		});

		it("TC-UT-STR-004: escapes carriage returns", () => {
			expect(escapeString("hello\rworld")).toBe("hello\\rworld");
		});

		it("TC-UT-STR-005: escapes tabs", () => {
			expect(escapeString("hello\tworld")).toBe("hello\\tworld");
		});

		it("TC-UT-STR-006: escapes multiple special chars", () => {
			expect(escapeString('hello\\"world\ntest')).toBe(
				'hello\\\\\\"world\\ntest',
			);
		});

		it("TC-UT-STR-007: handles empty string", () => {
			expect(escapeString("")).toBe("");
		});

		it("TC-UT-STR-008: handles string with no special chars", () => {
			expect(escapeString("helloworld")).toBe("helloworld");
		});
	});

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

	describe("serializePayloadData", () => {
		it("TC-UT-STR-017: returns 'null' for null data", () => {
			expect(serializePayloadData(null)).toBe("null");
		});

		it("TC-UT-STR-018: returns 'null' for empty object", () => {
			expect(serializePayloadData({})).toBe("null");
		});

		it("TC-UT-STR-019: serializes object with empty string value (not null)", () => {
			// Object with empty string value is still serialized (has keys)
			const result = serializePayloadData({ a: "" });
			expect(result).toBe('{\n  "a": ""\n}');
		});

		it("TC-UT-STR-020: serializes object with data", () => {
			const result = serializePayloadData({ name: "test", value: 123 });
			expect(result).toBe('{\n  "name": "test",\n  "value": 123\n}');
		});

		it("TC-UT-STR-021: handles nested objects", () => {
			const result = serializePayloadData({ nested: { key: "value" } });
			expect(result).toContain('"nested"');
			expect(result).toContain('"key"');
			expect(result).toContain('"value"');
		});

		it("TC-UT-STR-022: handles arrays in data", () => {
			const result = serializePayloadData({ items: ["a", "b", "c"] });
			expect(result).toContain('"items"');
			expect(result).toContain('"a"');
		});
	});
});
