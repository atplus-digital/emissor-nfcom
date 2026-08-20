import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { writeDiffDebug } from "@generators/io/diff-debug";

describe("diff-debug", () => {
	let tempRoot = "";
	let reportsDir = "";

	beforeEach(() => {
		tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "diff-debug-"));
		reportsDir = path.join(tempRoot, "reports");
	});

	afterEach(() => {
		if (tempRoot && fs.existsSync(tempRoot)) {
			fs.rmSync(tempRoot, { recursive: true, force: true });
		}
	});

	function writeFile(
		base: string,
		relativePath: string,
		content: string,
	): void {
		const full = path.join(base, relativePath);
		fs.mkdirSync(path.dirname(full), { recursive: true });
		fs.writeFileSync(full, content, "utf-8");
	}

	it("TC-UT-DD-001: should report zero files when temp and output are identical", () => {
		const tempDir = path.join(tempRoot, "temp");
		const outputDir = path.join(tempRoot, "output");
		writeFile(tempDir, "schemas.ts", "export const x = 1;\n");
		writeFile(outputDir, "schemas.ts", "export const x = 1;\n");

		const summary = writeDiffDebug(
			[{ tempDir, outputDir, label: "test" }],
			reportsDir,
		);

		expect(summary.totalFiles).toBe(0);
		expect(fs.existsSync(path.join(reportsDir, "diff-debug.txt"))).toBe(true);
	});

	it("TC-UT-DD-002: should detect a changed file and write a unified diff", () => {
		const tempDir = path.join(tempRoot, "temp");
		const outputDir = path.join(tempRoot, "output");
		writeFile(tempDir, "schemas.ts", "export const x = 2;\n");
		writeFile(outputDir, "schemas.ts", "export const x = 1;\n");

		const summary = writeDiffDebug(
			[{ tempDir, outputDir, label: "test" }],
			reportsDir,
		);

		expect(summary.totalFiles).toBe(1);
		expect(summary.byReason.changed).toBe(1);

		const report = fs.readFileSync(
			path.join(reportsDir, "diff-debug.txt"),
			"utf-8",
		);
		// O diff unificado deve marcar a linha removida e a adicionada
		expect(report).toContain("-export const x = 1;");
		expect(report).toContain("+export const x = 2;");
		expect(report).toContain("schemas.ts");
	});

	it("TC-UT-DD-003: should detect added and deleted files", () => {
		const tempDir = path.join(tempRoot, "temp");
		const outputDir = path.join(tempRoot, "output");
		// added: exists in temp, not in output
		writeFile(tempDir, "novo.ts", "export const n = 1;\n");
		// deleted: exists in output, not in temp
		writeFile(outputDir, "velho.ts", "export const v = 1;\n");

		const summary = writeDiffDebug(
			[{ tempDir, outputDir, label: "test" }],
			reportsDir,
		);

		expect(summary.totalFiles).toBe(2);
		expect(summary.byReason.added).toBe(1);
		expect(summary.byReason.deleted).toBe(1);

		const report = fs.readFileSync(
			path.join(reportsDir, "diff-debug.txt"),
			"utf-8",
		);
		expect(report).toContain("novo.ts (added)");
		expect(report).toContain("velho.ts (deleted)");
	});

	it("TC-UT-DD-004: should include the hunk header in the unified diff", () => {
		const tempDir = path.join(tempRoot, "temp");
		const outputDir = path.join(tempRoot, "output");
		const oldContent = "line a\nline b\nline c\nline d\n";
		const newContent = "line a\nline b\nline CHANGED\nline d\n";
		writeFile(tempDir, "f.ts", newContent);
		writeFile(outputDir, "f.ts", oldContent);

		const summary = writeDiffDebug(
			[{ tempDir, outputDir, label: "test" }],
			reportsDir,
		);

		expect(summary.totalFiles).toBe(1);
		const report = fs.readFileSync(
			path.join(reportsDir, "diff-debug.txt"),
			"utf-8",
		);
		// O hunk header segue o formato @@ -start,len +start,len @@
		expect(report).toMatch(/@@ -\d+,\d+ \+\d+,\d+ @@/);
		expect(report).toContain("-line c");
		expect(report).toContain("+line CHANGED");
		// Contexto: as linhas inalteradas ao redor devem aparecer com prefixo " "
		expect(report).toContain(" line a");
		expect(report).toContain(" line b");
		expect(report).toContain(" line d");
	});
});
