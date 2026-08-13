import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
	listTypeScriptFilesInDirectory,
	resetTypeScriptValidationCache,
	validateTypeScriptDirectory,
	validateTypeScriptFiles,
} from "@generators/lib/validation/tsc-validator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("tsc-validator", () => {
	let tempRoot = "";

	beforeEach(() => {
		resetTypeScriptValidationCache();
		tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tsc-validator-"));
	});

	afterEach(() => {
		resetTypeScriptValidationCache();
		if (tempRoot && fs.existsSync(tempRoot)) {
			fs.rmSync(tempRoot, { recursive: true, force: true });
		}
	});

	function writeFile(relativePath: string, content: string): string {
		const fullPath = path.join(tempRoot, relativePath);
		fs.mkdirSync(path.dirname(fullPath), { recursive: true });
		fs.writeFileSync(fullPath, content, "utf-8");
		return fullPath;
	}

	it("TC-UT-VAL-001: should return true for valid TypeScript file", async () => {
		const filePath = writeFile("valid.ts", "export const value: number = 1;\n");

		const result = await validateTypeScriptFiles([filePath]);

		expect(result).toBe(true);
	});

	it("TC-UT-VAL-002: should return false for syntax error in TypeScript file", async () => {
		const filePath = writeFile(
			"invalid.ts",
			"export const value: number = 'string';\n",
		);

		const result = await validateTypeScriptFiles([filePath]);

		expect(result).toBe(false);
	});

	it("TC-UT-VAL-003: should return true when directory does not exist", async () => {
		const result = await validateTypeScriptDirectory(
			path.join(tempRoot, "missing-dir"),
		);

		expect(result).toBe(true);
	});

	it("TC-UT-VAL-004: should validate all TypeScript files in a directory", async () => {
		writeFile("dir/a.ts", "export const a: number = 1;\n");
		writeFile("dir/b.ts", "export const b: number = 2;\n");

		const result = await validateTypeScriptDirectory(
			path.join(tempRoot, "dir"),
		);

		expect(result).toBe(true);
		expect(
			listTypeScriptFilesInDirectory(path.join(tempRoot, "dir")),
		).toHaveLength(2);
	});

	it("TC-UT-VAL-005: should validate only the provided files in a directory", async () => {
		const validPath = writeFile(
			"partial/valid.ts",
			"export const ok: number = 1;\n",
		);
		writeFile("partial/invalid.ts", "export const bad: number = 'x';\n");

		const result = await validateTypeScriptDirectory(
			path.join(tempRoot, "partial"),
			{ files: [validPath] },
		);

		expect(result).toBe(true);
	});

	it("TC-UT-VAL-006: should limit error output to formatted diagnostics", async () => {
		const filePath = writeFile(
			"multi-error.ts",
			Array.from(
				{ length: 3 },
				(_, index) => `export const value${index}: number = 'x';`,
			).join("\n"),
		);

		const result = await validateTypeScriptFiles([filePath]);

		expect(result).toBe(false);
	});

	it("TC-UT-VAL-007: should use the generated tsconfig for validation", async () => {
		const filePath = writeFile("generated-config.ts", "export const ok = 1;\n");

		const result = await validateTypeScriptFiles([filePath]);

		expect(result).toBe(true);
	});

	it("TC-UT-VAL-008: should reuse cached validation results for the same files", async () => {
		const filePath = writeFile(
			"cache-hit.ts",
			"export const ok: number = 1;\n",
		);

		const firstRun = await validateTypeScriptFiles([filePath]);
		const secondRun = await validateTypeScriptFiles([filePath]);

		expect(firstRun).toBe(true);
		expect(secondRun).toBe(true);
	});

	it("TC-UT-VAL-009: should return true when no TypeScript files are provided", async () => {
		const result = await validateTypeScriptFiles([]);

		expect(result).toBe(true);
	});

	it("TC-UT-VAL-010: should ignore missing files in the provided list", async () => {
		const result = await validateTypeScriptFiles([
			path.join(tempRoot, "does-not-exist.ts"),
		]);

		expect(result).toBe(true);
	});

	it("TC-UT-VAL-011: should validate multiple files in one run", async () => {
		const a = writeFile("multi/a.ts", "export const a: number = 1;\n");
		const b = writeFile("multi/b.ts", "export const b: number = 2;\n");

		const result = await validateTypeScriptFiles([a, b]);

		expect(result).toBe(true);
	});
});
