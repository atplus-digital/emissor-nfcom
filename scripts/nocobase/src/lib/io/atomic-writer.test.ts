import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@generators/lib/cli/cli-output", () => ({
	writeCliError: vi.fn(),
}));

vi.mock("@generators/lib/validation/linter-runner", () => ({
	runLinterFix: vi.fn(async () => undefined),
}));

vi.mock("@generators/lib/validation/tsc-validator", () => ({
	validateTypeScriptDirectory: vi.fn(async () => true),
	validateTypeScriptFiles: vi.fn(async () => true),
}));

import { writeCliError } from "@generators/lib/cli/cli-output";
import { runLinterFix } from "@generators/lib/validation/linter-runner";
import {
	validateTypeScriptDirectory,
	validateTypeScriptFiles,
} from "@generators/lib/validation/tsc-validator";
import {
	backupDir,
	cleanupTempSessionDir,
	computeDiff,
	removeDir,
	runValidation,
	swapTempToOutput,
} from "./atomic-writer";

describe("TC-UT-AW-001: computeDiff returns empty when no changes", () => {
	const tempDir = "/tmp/test-diff-empty/temp";
	const outputDir = "/tmp/test-diff-empty/output";

	beforeEach(() => {
		// Setup: create identical file in both
		fs.mkdirSync(outputDir, { recursive: true });
		fs.mkdirSync(tempDir, { recursive: true });
		fs.writeFileSync(path.join(tempDir, "file.ts"), "const x = 1;");
		fs.writeFileSync(path.join(outputDir, "file.ts"), "const x = 1;");
	});

	afterEach(() => {
		fs.rmSync("/tmp/test-diff-empty", { recursive: true, force: true });
	});

	it("should return empty changedFiles when files are identical", () => {
		const result = computeDiff(tempDir, outputDir);
		expect(result.changedFiles).toHaveLength(0);
		expect(result.unchangedFiles).toContain("file.ts");
	});
});

describe("TC-UT-AW-002: computeDiff returns changed files list when changes exist", () => {
	const tempDir = "/tmp/test-diff-changed/temp";
	const outputDir = "/tmp/test-diff-changed/output";

	beforeEach(() => {
		fs.mkdirSync(outputDir, { recursive: true });
		fs.mkdirSync(tempDir, { recursive: true });
		fs.writeFileSync(path.join(tempDir, "file.ts"), "const x = 2;");
		fs.writeFileSync(path.join(outputDir, "file.ts"), "const x = 1;");
	});

	afterEach(() => {
		fs.rmSync("/tmp/test-diff-changed", { recursive: true, force: true });
	});

	it("should return file in changedFiles when content differs", () => {
		const result = computeDiff(tempDir, outputDir);
		expect(result.changedFiles).toContain("file.ts");
		expect(result.unchangedFiles).toHaveLength(0);
	});
});

describe("TC-UT-AW-003: computeDiff detects deleted files", () => {
	const tempDir = "/tmp/test-diff-deleted/temp";
	const outputDir = "/tmp/test-diff-deleted/output";

	beforeEach(() => {
		fs.mkdirSync(outputDir, { recursive: true });
		fs.mkdirSync(tempDir, { recursive: true });
		// Only in output
		fs.writeFileSync(path.join(outputDir, "removed.ts"), "const y = 1;");
	});

	afterEach(() => {
		fs.rmSync("/tmp/test-diff-deleted", { recursive: true, force: true });
	});

	it("should return file in deletedFiles when only in output", () => {
		const result = computeDiff(tempDir, outputDir);
		expect(result.deletedFiles).toContain("removed.ts");
	});
});

describe("TC-UT-AW-004: swapTempToOutput on clean run (no backup needed)", () => {
	const tempDir = "/tmp/test-swap-clean/temp";
	const outputDir = "/tmp/test-swap-clean/output";

	beforeEach(() => {
		fs.mkdirSync(tempDir, { recursive: true });
		fs.mkdirSync(path.dirname(outputDir), { recursive: true });
		fs.writeFileSync(path.join(tempDir, "file.ts"), "const x = 1;");
	});

	afterEach(() => {
		fs.rmSync("/tmp/test-swap-clean", { recursive: true, force: true });
	});

	it("should move temp to output and remove temp", () => {
		swapTempToOutput(tempDir, outputDir);

		expect(fs.existsSync(outputDir)).toBe(true);
		expect(fs.existsSync(path.join(outputDir, "file.ts"))).toBe(true);
		expect(fs.existsSync(tempDir)).toBe(false);
	});
});

describe("TC-UT-AW-005: swapTempToOutput replaces existing output", () => {
	const tempDir = "/tmp/test-swap-replace/temp";
	const outputDir = "/tmp/test-swap-replace/output";

	beforeEach(() => {
		fs.mkdirSync(tempDir, { recursive: true });
		fs.mkdirSync(outputDir, { recursive: true });
		// Old file in output
		fs.writeFileSync(path.join(outputDir, "old.ts"), "const old = 1;");
		// New file in temp
		fs.writeFileSync(path.join(tempDir, "new.ts"), "const new = 2;");
	});

	afterEach(() => {
		fs.rmSync("/tmp/test-swap-replace", { recursive: true, force: true });
	});

	it("should remove old output and replace with temp content", () => {
		swapTempToOutput(tempDir, outputDir);

		expect(fs.existsSync(path.join(outputDir, "new.ts"))).toBe(true);
		expect(fs.existsSync(path.join(outputDir, "old.ts"))).toBe(false);
	});
});

describe("TC-UT-AW-006: backupDir copies directory", () => {
	const sourceDir = "/tmp/test-backup/source";
	const backupDirPath = "/tmp/test-backup/backup";

	beforeEach(() => {
		fs.mkdirSync(sourceDir, { recursive: true });
		fs.writeFileSync(path.join(sourceDir, "file.ts"), "const x = 1;");
	});

	afterEach(() => {
		fs.rmSync("/tmp/test-backup", { recursive: true, force: true });
	});

	it("should copy source to backup destination", () => {
		backupDir(sourceDir, backupDirPath);

		expect(fs.existsSync(path.join(backupDirPath, "file.ts"))).toBe(true);
	});
});

describe("TC-UT-AW-007: backupDir returns early if source does not exist", () => {
	const sourceDir = "/tmp/test-backup-missing/source";
	const backupDirPath = "/tmp/test-backup-missing/backup";

	afterEach(() => {
		fs.rmSync("/tmp/test-backup-missing", { recursive: true, force: true });
	});

	it("should not throw when source does not exist", () => {
		expect(() => backupDir(sourceDir, backupDirPath)).not.toThrow();
	});
});

describe("TC-UT-AW-008: removeDir deletes directory", () => {
	const dir = "/tmp/test-remove";

	beforeEach(() => {
		fs.mkdirSync(dir, { recursive: true });
		fs.writeFileSync(path.join(dir, "file.ts"), "const x = 1;");
	});

	afterEach(() => {
		fs.rmSync("/tmp/test-remove", { recursive: true, force: true });
	});

	it("should delete directory and contents", () => {
		removeDir(dir);
		expect(fs.existsSync(dir)).toBe(false);
	});
});

describe("TC-UT-AW-009: cleanupTempSessionDir cleans temp session", () => {
	const tempDir = "/tmp/.temp/test-session/temp";

	beforeEach(() => {
		// Clean up first to ensure empty state
		fs.rmSync("/tmp/.temp", { recursive: true, force: true });
		fs.mkdirSync(tempDir, { recursive: true });
		fs.writeFileSync(path.join(tempDir, "file.ts"), "const x = 1;");
	});

	afterEach(() => {
		fs.rmSync("/tmp/.temp", { recursive: true, force: true });
	});

	it("should remove temp dir", () => {
		cleanupTempSessionDir(tempDir);
		expect(fs.existsSync(tempDir)).toBe(false);
	});
});

describe("TC-UT-AW-010: computeDiff handles new file in temp not in output", () => {
	const tempDir = "/tmp/test-diff-new/temp";
	const outputDir = "/tmp/test-diff-new/output";

	beforeEach(() => {
		fs.mkdirSync(tempDir, { recursive: true });
		fs.mkdirSync(outputDir, { recursive: true });
		// New file only in temp
		fs.writeFileSync(path.join(tempDir, "newfile.ts"), "const x = 1;");
	});

	afterEach(() => {
		fs.rmSync("/tmp/test-diff-new", { recursive: true, force: true });
	});

	it("should detect new files as changed", () => {
		const result = computeDiff(tempDir, outputDir);
		expect(result.changedFiles).toContain("newfile.ts");
	});
});

describe("TC-UT-AW-011: swapTempToOutput creates parent dir if missing", () => {
	const tempDir = "/tmp/test-swap-parent/temp";
	const outputDir = "/tmp/test-swap-parent/deep/nested/output";

	beforeEach(() => {
		fs.mkdirSync(tempDir, { recursive: true });
		fs.writeFileSync(path.join(tempDir, "file.ts"), "const x = 1;");
	});

	afterEach(() => {
		fs.rmSync("/tmp/test-swap-parent", { recursive: true, force: true });
	});

	it("should create parent directories if they do not exist", () => {
		swapTempToOutput(tempDir, outputDir);

		expect(fs.existsSync(outputDir)).toBe(true);
		expect(fs.existsSync(path.join(outputDir, "file.ts"))).toBe(true);
	});
});

describe("TC-UT-AW-012: computeDiff handles multiple unchanged files", () => {
	const tempDir = "/tmp/test-diff-multi/temp";
	const outputDir = "/tmp/test-diff-multi/output";

	beforeEach(() => {
		fs.mkdirSync(tempDir, { recursive: true });
		fs.mkdirSync(outputDir, { recursive: true });
		fs.writeFileSync(path.join(tempDir, "file1.ts"), "const a = 1;");
		fs.writeFileSync(path.join(outputDir, "file1.ts"), "const a = 1;");
		fs.writeFileSync(path.join(tempDir, "file2.ts"), "const b = 2;");
		fs.writeFileSync(path.join(outputDir, "file2.ts"), "const b = 2;");
	});

	afterEach(() => {
		fs.rmSync("/tmp/test-diff-multi", { recursive: true, force: true });
	});

	it("should return all files as unchanged when content matches", () => {
		const result = computeDiff(tempDir, outputDir);
		expect(result.unchangedFiles).toHaveLength(2);
		expect(result.changedFiles).toHaveLength(0);
	});
});

describe("TC-UT-AW-013: removeDir handles non-existent directory", () => {
	const dir = "/tmp/test-remove-nonexistent";

	afterEach(() => {
		fs.rmSync("/tmp/test-remove-nonexistent", { recursive: true, force: true });
	});

	it("should not throw when directory does not exist", () => {
		expect(() => removeDir(dir)).not.toThrow();
	});
});

describe("TC-UT-AW-014: computeDiff handles nested directory structure", () => {
	const tempDir = "/tmp/test-diff-nested/temp";
	const outputDir = "/tmp/test-diff-nested/output";

	beforeEach(() => {
		fs.mkdirSync(outputDir, { recursive: true });
		fs.mkdirSync(tempDir, { recursive: true });
		// Create nested directory structure
		fs.mkdirSync(path.join(tempDir, "subdir"), { recursive: true });
		fs.mkdirSync(path.join(outputDir, "subdir"), { recursive: true });
		fs.writeFileSync(path.join(tempDir, "file.ts"), "const x = 1;");
		fs.writeFileSync(path.join(tempDir, "subdir", "nested.ts"), "const y = 2;");
		fs.writeFileSync(path.join(outputDir, "file.ts"), "const x = 1;");
		fs.writeFileSync(
			path.join(outputDir, "subdir", "nested.ts"),
			"const y = 2;",
		);
	});

	afterEach(() => {
		fs.rmSync("/tmp/test-diff-nested", { recursive: true, force: true });
	});

	it("should recursively find all files in nested directories", () => {
		const result = computeDiff(tempDir, outputDir);
		expect(result.unchangedFiles).toContain("file.ts");
		expect(result.unchangedFiles).toContain(path.join("subdir", "nested.ts"));
	});
});

describe("TC-UT-AW-015: computeDiff detects changes in nested files", () => {
	const tempDir = "/tmp/test-diff-nested-change/temp";
	const outputDir = "/tmp/test-diff-nested-change/output";

	beforeEach(() => {
		fs.mkdirSync(outputDir, { recursive: true });
		fs.mkdirSync(tempDir, { recursive: true });
		fs.mkdirSync(path.join(tempDir, "subdir"), { recursive: true });
		fs.mkdirSync(path.join(outputDir, "subdir"), { recursive: true });
		fs.writeFileSync(
			path.join(tempDir, "subdir", "nested.ts"),
			"const changed = 1;",
		);
		fs.writeFileSync(
			path.join(outputDir, "subdir", "nested.ts"),
			"const original = 1;",
		);
	});

	afterEach(() => {
		fs.rmSync("/tmp/test-diff-nested-change", { recursive: true, force: true });
	});

	it("should detect changes in nested files", () => {
		const result = computeDiff(tempDir, outputDir);
		expect(result.changedFiles).toContain(path.join("subdir", "nested.ts"));
	});
});

describe("TC-UT-AW-016: cleanupTempSessionDir removes empty .temp root", () => {
	it("should remove .temp root when empty after session cleanup", () => {
		// The cleanupTempSessionDir function only removes .temp root if tempDir
		// is directly under .temp (e.g., /tmp/.temp/session-id)
		// For paths like /tmp/.temp/session-id/temp, it only removes the session dir
		const sessionId = `cleanup-test-session-${Date.now()}`;
		// This is directly under .temp: /tmp/.temp/sessionId
		const tempDir = `/tmp/.temp/${sessionId}`;

		// Clean up before test - ensure a clean state
		fs.rmSync("/tmp/.temp", { recursive: true, force: true });

		// Create the temp directory (no subdirectory)
		fs.mkdirSync(tempDir, { recursive: true });

		// Call cleanup
		cleanupTempSessionDir(tempDir);

		// Verify tempDir is removed
		expect(fs.existsSync(tempDir)).toBe(false);

		// Verify .temp root is removed since it should be empty now
		expect(fs.existsSync("/tmp/.temp")).toBe(false);

		// Cleanup after (should be no-op since everything should be cleaned)
		fs.rmSync("/tmp/.temp", { recursive: true, force: true });
	});

	it("should return early when .temp root is already missing after session cleanup", () => {
		const sessionId = `cleanup-missing-root-${Date.now()}`;
		const tempDir = `/tmp/.temp/${sessionId}`;

		fs.rmSync("/tmp/.temp", { recursive: true, force: true });
		fs.mkdirSync(tempDir, { recursive: true });
		fs.rmSync(tempDir, { recursive: true, force: true });

		expect(() => cleanupTempSessionDir(tempDir)).not.toThrow();
		expect(fs.existsSync("/tmp/.temp")).toBe(false);

		fs.rmSync("/tmp/.temp", { recursive: true, force: true });
	});

	it("should not remove .temp when session path is nested deeper", () => {
		// When tempDir is /tmp/.temp/sessionId/temp, only /tmp/.temp/sessionId/temp gets removed
		const sessionId = `cleanup-test-session-nested-${Date.now()}`;
		const tempDir = `/tmp/.temp/${sessionId}/temp`;

		// Clean up before test
		fs.rmSync("/tmp/.temp", { recursive: true, force: true });

		// Create nested temp directory
		fs.mkdirSync(tempDir, { recursive: true });

		// Call cleanup
		cleanupTempSessionDir(tempDir);

		// tempDir should be removed
		expect(fs.existsSync(tempDir)).toBe(false);

		// But the session parent should still exist (and .temp should exist)
		expect(fs.existsSync(`/tmp/.temp/${sessionId}`)).toBe(true);
		expect(fs.existsSync("/tmp/.temp")).toBe(true);

		// Cleanup after
		fs.rmSync("/tmp/.temp", { recursive: true, force: true });
	});
});

describe("TC-UT-AW-017: computeDiff when outputDir does not exist", () => {
	const tempDir = "/tmp/test-diff-no-output/temp";

	beforeEach(() => {
		fs.mkdirSync(tempDir, { recursive: true });
		fs.writeFileSync(path.join(tempDir, "only-in-temp.ts"), "export {};");
	});

	afterEach(() => {
		fs.rmSync("/tmp/test-diff-no-output", { recursive: true, force: true });
	});

	it("should treat all temp files as changed when output dir is missing", () => {
		const outputDir = "/tmp/test-diff-no-output/missing-output";

		const result = computeDiff(tempDir, outputDir);

		expect(result.changedFiles).toEqual(["only-in-temp.ts"]);
		expect(result.unchangedFiles).toHaveLength(0);
		expect(result.deletedFiles).toHaveLength(0);
	});
});

describe("TC-UT-AW-018: computeDiff mixed changed, unchanged, deleted, and new files", () => {
	const tempDir = "/tmp/test-diff-mixed/temp";
	const outputDir = "/tmp/test-diff-mixed/output";

	beforeEach(() => {
		fs.mkdirSync(path.join(tempDir, "nested"), { recursive: true });
		fs.mkdirSync(path.join(outputDir, "nested"), { recursive: true });

		fs.writeFileSync(path.join(tempDir, "unchanged.ts"), "const same = 1;");
		fs.writeFileSync(path.join(outputDir, "unchanged.ts"), "const same = 1;");

		fs.writeFileSync(path.join(tempDir, "changed.ts"), "const next = 2;");
		fs.writeFileSync(path.join(outputDir, "changed.ts"), "const prev = 1;");

		fs.writeFileSync(
			path.join(tempDir, "nested", "new.ts"),
			"export const created = true;",
		);

		fs.writeFileSync(
			path.join(outputDir, "removed.ts"),
			"export const gone = true;",
		);
	});

	afterEach(() => {
		fs.rmSync("/tmp/test-diff-mixed", { recursive: true, force: true });
	});

	it("should classify every diff branch in a single run", () => {
		const result = computeDiff(tempDir, outputDir);

		expect(result.unchangedFiles).toEqual(["unchanged.ts"]);
		expect(result.changedFiles).toEqual(
			expect.arrayContaining(["changed.ts", path.join("nested", "new.ts")]),
		);
		expect(result.changedFiles).toHaveLength(2);
		expect(result.deletedFiles).toEqual(["removed.ts"]);
	});
});

describe("TC-UT-AW-019: cleanupTempSessionDir skips Vitest coverage temp paths", () => {
	const testRoot = "/tmp/test-cleanup-vitest-skip";

	afterEach(() => {
		fs.rmSync(testRoot, { recursive: true, force: true });
	});

	it("should not remove paths under .vitest-coverage/.tmp", () => {
		const tempDir = path.join(
			testRoot,
			".vitest-coverage",
			".tmp",
			`session-${Date.now()}`,
		);
		fs.mkdirSync(tempDir, { recursive: true });
		fs.writeFileSync(path.join(tempDir, "coverage-artifact.json"), "{}");

		cleanupTempSessionDir(tempDir);

		expect(fs.existsSync(tempDir)).toBe(true);
		expect(fs.existsSync(path.join(tempDir, "coverage-artifact.json"))).toBe(
			true,
		);
	});

	it("should not remove paths under coverage/.tmp", () => {
		const tempDir = path.join(
			testRoot,
			"coverage",
			".tmp",
			`session-${Date.now()}`,
		);
		fs.mkdirSync(tempDir, { recursive: true });
		fs.writeFileSync(path.join(tempDir, "coverage-artifact.json"), "{}");

		cleanupTempSessionDir(tempDir);

		expect(fs.existsSync(tempDir)).toBe(true);
	});
});

describe("TC-UT-AW-020: cleanupTempSessionDir guards unrelated temp roots", () => {
	const testRoot = "/tmp/test-cleanup-guards";

	afterEach(() => {
		fs.rmSync(testRoot, { recursive: true, force: true });
	});

	it("should skip cleanup when parent directory basename is .tmp outside coverage", () => {
		const tempDir = path.join(testRoot, "workspace", ".tmp", "session");
		fs.mkdirSync(tempDir, { recursive: true });
		fs.writeFileSync(path.join(tempDir, "file.ts"), "const x = 1;");

		cleanupTempSessionDir(tempDir);

		expect(fs.existsSync(tempDir)).toBe(true);
	});

	it("should remove session dir but keep disallowed .temp roots", () => {
		const tempRootDir = path.join(testRoot, "custom-root", ".temp");
		const tempDir = path.join(tempRootDir, "session");
		fs.mkdirSync(tempDir, { recursive: true });
		fs.writeFileSync(path.join(tempDir, "file.ts"), "const x = 1;");

		cleanupTempSessionDir(tempDir);

		expect(fs.existsSync(tempDir)).toBe(false);
		expect(fs.existsSync(tempRootDir)).toBe(true);
	});

	it("should return early when allowed .temp root is already missing", () => {
		const tempRootDir = "/tmp/.temp";
		const tempDir = path.join(tempRootDir, `missing-root-${Date.now()}`);

		fs.rmSync(tempRootDir, { recursive: true, force: true });
		fs.mkdirSync(tempDir, { recursive: true });
		fs.rmSync(tempDir, { recursive: true, force: true });
		fs.rmSync(tempRootDir, { recursive: true, force: true });

		expect(() => cleanupTempSessionDir(tempDir)).not.toThrow();
		expect(fs.existsSync(tempRootDir)).toBe(false);
	});
});

describe("TC-UT-AW-021: cleanupTempSessionDir nested session paths and empty root", () => {
	afterEach(() => {
		fs.rmSync("/tmp/.temp", { recursive: true, force: true });
	});

	it("should keep .temp root when another session remains", () => {
		const activeSessionId = `active-session-${Date.now()}`;
		const closingSessionId = `closing-session-${Date.now()}`;
		const activeSessionDir = `/tmp/.temp/${activeSessionId}`;
		const closingSessionDir = `/tmp/.temp/${closingSessionId}`;

		fs.rmSync("/tmp/.temp", { recursive: true, force: true });
		fs.mkdirSync(activeSessionDir, { recursive: true });
		fs.mkdirSync(closingSessionDir, { recursive: true });
		fs.writeFileSync(path.join(activeSessionDir, "keep.ts"), "const keep = 1;");

		cleanupTempSessionDir(closingSessionDir);

		expect(fs.existsSync(closingSessionDir)).toBe(false);
		expect(fs.existsSync(activeSessionDir)).toBe(true);
		expect(fs.existsSync("/tmp/.temp")).toBe(true);
	});

	it("should remove nested session temp dir without deleting .temp root", () => {
		const sessionId = `nested-session-${Date.now()}`;
		const tempDir = `/tmp/.temp/${sessionId}/workspace/temp`;

		fs.rmSync("/tmp/.temp", { recursive: true, force: true });
		fs.mkdirSync(tempDir, { recursive: true });
		fs.writeFileSync(path.join(tempDir, "file.ts"), "const x = 1;");

		cleanupTempSessionDir(tempDir);

		expect(fs.existsSync(tempDir)).toBe(false);
		expect(fs.existsSync(`/tmp/.temp/${sessionId}`)).toBe(true);
		expect(fs.existsSync("/tmp/.temp")).toBe(true);
	});
});

describe("TC-UT-AW-022: cleanupTempSessionDir removes empty cwd .temp root", () => {
	it("should remove project .temp root when the last session is cleaned up", () => {
		const tempRootDir = path.join(process.cwd(), ".temp");
		const sessionId = `cwd-cleanup-${Date.now()}`;
		const tempDir = path.join(tempRootDir, sessionId);

		fs.rmSync(tempRootDir, { recursive: true, force: true });
		fs.mkdirSync(tempDir, { recursive: true });

		cleanupTempSessionDir(tempDir);

		expect(fs.existsSync(tempDir)).toBe(false);
		expect(fs.existsSync(tempRootDir)).toBe(false);

		fs.rmSync(tempRootDir, { recursive: true, force: true });
	});
});

describe("TC-UT-AW-023: cleanupTempSessionDir non-.temp parent", () => {
	const testRoot = "/tmp/test-cleanup-non-temp-parent";

	afterEach(() => {
		fs.rmSync(testRoot, { recursive: true, force: true });
	});

	it("should remove temp dir without touching non-.temp parents", () => {
		const tempDir = path.join(testRoot, "session-only");
		fs.mkdirSync(tempDir, { recursive: true });
		fs.writeFileSync(path.join(tempDir, "file.ts"), "const x = 1;");

		cleanupTempSessionDir(tempDir);

		expect(fs.existsSync(tempDir)).toBe(false);
		expect(fs.existsSync(testRoot)).toBe(true);
	});
});

describe("TC-UT-AW-024: runValidation", () => {
	beforeEach(() => {
		vi.mocked(validateTypeScriptDirectory).mockReset();
		vi.mocked(validateTypeScriptFiles).mockReset();
		vi.mocked(runLinterFix).mockReset();
		vi.mocked(writeCliError).mockReset();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns true when validation and lint succeed", async () => {
		vi.mocked(validateTypeScriptDirectory).mockResolvedValue(true);

		const result = await runValidation("/tmp/generated");

		expect(result).toBe(true);
		expect(validateTypeScriptDirectory).toHaveBeenCalledWith("/tmp/generated");
		expect(runLinterFix).toHaveBeenCalledWith(["/tmp/generated"]);
	});

	it("returns false and prints error when TypeScript validation fails", async () => {
		vi.mocked(validateTypeScriptDirectory).mockResolvedValue(false);

		const result = await runValidation("/tmp/generated");

		expect(result).toBe(false);
		expect(writeCliError).toHaveBeenCalledWith(
			"❌ Validação TypeScript falhou.",
		);
		expect(runLinterFix).not.toHaveBeenCalled();
	});

	it("skips validation and lint when disabled via options", async () => {
		const result = await runValidation("/tmp/generated", {
			validate: false,
			lint: false,
		});

		expect(result).toBe(true);
		expect(validateTypeScriptDirectory).not.toHaveBeenCalled();
		expect(runLinterFix).not.toHaveBeenCalled();
	});

	it("skips TypeScript validation but still runs lint when validate is false", async () => {
		const result = await runValidation("/tmp/generated", {
			validate: false,
			lint: true,
		});

		expect(result).toBe(true);
		expect(validateTypeScriptDirectory).not.toHaveBeenCalled();
		expect(runLinterFix).toHaveBeenCalledWith(["/tmp/generated"]);
	});

	it("runs validation but skips lint when lint is false", async () => {
		vi.mocked(validateTypeScriptDirectory).mockResolvedValue(true);

		const result = await runValidation("/tmp/generated", {
			validate: true,
			lint: false,
		});

		expect(result).toBe(true);
		expect(validateTypeScriptDirectory).toHaveBeenCalledWith("/tmp/generated");
		expect(runLinterFix).not.toHaveBeenCalled();
	});

	it("validates changed files and lints affected directories", async () => {
		vi.mocked(validateTypeScriptFiles).mockResolvedValue(true);

		const result = await runValidation({
			files: ["/tmp/generated/a.ts"],
			lintDirs: ["/tmp/generated"],
		});

		expect(result).toBe(true);
		expect(validateTypeScriptFiles).toHaveBeenCalledWith([
			"/tmp/generated/a.ts",
		]);
		expect(runLinterFix).toHaveBeenCalledWith(["/tmp/generated"]);
	});
});
