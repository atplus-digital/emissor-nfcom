import * as fs from "node:fs";
import * as path from "node:path";
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi,
	mock,
} from "bun:test";

const originalProcess = process;

// Mock the external dependencies that lifecycle-tasks imports from @generators paths
// IMPORTANT: These vi.mock calls MUST be at the top level, before any imports
mock.module("@generators/lib/io/atomic-writer", () => ({
	backupDir: vi.fn(),
	cleanupTempSessionDir: vi.fn(),
	computeDiff: vi.fn(),
	runValidation: vi.fn(),
	swapTempToOutput: vi.fn(),
}));

mock.module("@generators/lib/validation/tsc-validator", () => ({
	listTypeScriptFilesInDirectory: vi.fn(() => []),
}));

mock.module("@generators/lib/validation/validation-options", () => ({
	isValidationSkipped: vi.fn(() => false),
}));

mock.module("@generators/lib/pipeline/reports", () => ({
	countReports: vi.fn(() => 0),
	renderReportsMarkdown: vi.fn(() => "# Report\n"),
}));

// Import the mocked modules for setting up test assertions
import {
	backupDir,
	cleanupTempSessionDir,
	computeDiff,
	runValidation,
	swapTempToOutput,
} from "@generators/lib/io/atomic-writer";
import {
	backupCurrentOutput,
	diffTempVsOutput,
	handleNoChanges,
	type LifecycleCtx,
	type LifecycleTaskParams,
	renderReportsSummary,
	swapTempToOutputDirs,
	validateGeneratedOutput,
} from "@generators/lib/lifecycle/lifecycle-tasks";
import type { PipelineReportsContext } from "@generators/lib/pipeline/reports";
import {
	countReports,
	renderReportsMarkdown,
} from "@generators/lib/pipeline/reports";
import { listTypeScriptFilesInDirectory } from "@generators/lib/validation/tsc-validator";
import { isValidationSkipped } from "@generators/lib/validation/validation-options";
import { setDiffDebug } from "@generators/lib/validation/diff-debug-options";
import type { TaskRunner } from "@shared/types";

// Working directory for tests
const WORKSPACE_ROOT = "/tmp/test-lifecycle-tasks";

describe("lifecycle-tasks", () => {
	let mockTask: Partial<TaskRunner>;
	let mockContext: PipelineReportsContext;
	let baseParams: LifecycleTaskParams<unknown, unknown>;

	beforeEach(() => {
		vi.clearAllMocks();

		// Stub process.cwd() to return our workspace
		globalThis.process = {
			...process,
			cwd: () => WORKSPACE_ROOT,
		};

		// Create temp directory
		fs.mkdirSync(WORKSPACE_ROOT, { recursive: true });
		fs.mkdirSync(path.join(WORKSPACE_ROOT, ".backup"), { recursive: true });
		fs.mkdirSync(path.join(WORKSPACE_ROOT, ".temp"), { recursive: true });

		// Default mocks
		backupDir.mockReturnValue(undefined);
		cleanupTempSessionDir.mockReturnValue(undefined);
		computeDiff.mockReturnValue({
			changedFiles: [],
			unchangedFiles: [],
			deletedFiles: [],
		});
		runValidation.mockResolvedValue(true);
		swapTempToOutput.mockReturnValue(undefined);
		countReports.mockReturnValue(0);
		renderReportsMarkdown.mockReturnValue("# Report\n");

		// Setup mock task
		mockTask = {
			output: "",
		};

		// Setup mock context
		mockContext = {
			schemaVersion: 1,
			namespaces: {},
		};

		// Setup base params
		baseParams = {
			tempDir: path.join(WORKSPACE_ROOT, ".temp", "123-abc"),
			outputDirs: ["src/generated"],
			context: {
				tempDir: path.join(WORKSPACE_ROOT, ".temp", "123-abc"),
				outputDirs: ["src/generated"],
				runtimeConfig: {},
				reports: mockContext,
			},
			label: "Test Pipeline",
			task: mockTask as TaskRunner,
			cwd: WORKSPACE_ROOT,
			timestamp: 123456,
			randomId: "abc123",
			onReportReady: vi.fn(),
		};
	});

	afterEach(() => {
		fs.rmSync("/tmp/test-lifecycle-tasks", { recursive: true, force: true });
		setDiffDebug(false);
		vi.restoreAllMocks();
		globalThis.process = originalProcess;
	});

	// ══════════════════════════════════════════════════════════════
	// TC-UT-LIFT-001: validateGeneratedOutput calls runValidation with changed files
	// ══════════════════════════════════════════════════════════════
	it("TC-UT-LIFT-001: should call runValidation with changed files only", async () => {
		const tempGenerated = path.join(
			WORKSPACE_ROOT,
			".temp",
			"123-abc",
			"src/generated",
		);
		fs.mkdirSync(tempGenerated, { recursive: true });
		fs.writeFileSync(path.join(tempGenerated, "a.ts"), "export const a = 1;\n");
		fs.writeFileSync(path.join(tempGenerated, "b.ts"), "export const b = 2;\n");

		const ctx: LifecycleCtx = {
			hasChanges: true,
			diffs: [
				{
					changedFiles: ["a.ts"],
					unchangedFiles: ["b.ts"],
					deletedFiles: [],
				},
			],
		};

		await validateGeneratedOutput(ctx, baseParams);

		expect(runValidation).toHaveBeenCalledWith({
			files: [path.join(tempGenerated, "a.ts")],
			lintDirs: [tempGenerated],
		});
	});

	// ══════════════════════════════════════════════════════════════
	// TC-UT-LIFT-002: validateGeneratedOutput throws when validation fails
	// ══════════════════════════════════════════════════════════════
	it("TC-UT-LIFT-002: should throw and cleanup when validation fails", async () => {
		// Arrange
		const tempGenerated = path.join(
			WORKSPACE_ROOT,
			".temp",
			"123-abc",
			"src/generated",
		);
		fs.mkdirSync(tempGenerated, { recursive: true });
		fs.writeFileSync(path.join(tempGenerated, "a.ts"), "export const a = 1;\n");
		runValidation.mockResolvedValue(false);
		const ctx: LifecycleCtx = {
			hasChanges: true,
			diffs: [
				{
					changedFiles: ["a.ts"],
					unchangedFiles: [],
					deletedFiles: [],
				},
			],
		};

		// Act & Assert
		await expect(validateGeneratedOutput(ctx, baseParams)).rejects.toThrow(
			"Validação falhou para a saída gerada. Alterações descartadas.",
		);

		// Assert - cleanup should be called
		expect(cleanupTempSessionDir).toHaveBeenCalledWith(baseParams.tempDir);
	});

	// ══════════════════════════════════════════════════════════════
	// TC-UT-LIFT-003: validateGeneratedOutput skips non-existent temp output dirs
	// ══════════════════════════════════════════════════════════════
	it("TC-UT-LIFT-003: should skip validation when there are no changes", async () => {
		const ctx: LifecycleCtx = {
			hasChanges: false,
			diffs: [
				{
					changedFiles: [],
					unchangedFiles: ["a.ts"],
					deletedFiles: [],
				},
			],
		};

		await validateGeneratedOutput(ctx, baseParams);

		expect(runValidation).not.toHaveBeenCalled();
	});

	it("TC-UT-LIFT-003b: should validate entire directory when files were deleted", async () => {
		const tempGenerated = path.join(
			WORKSPACE_ROOT,
			".temp",
			"123-abc",
			"src/generated",
		);
		fs.mkdirSync(tempGenerated, { recursive: true });
		listTypeScriptFilesInDirectory.mockReturnValue([
			path.join(tempGenerated, "remaining.ts"),
		]);

		const ctx: LifecycleCtx = {
			hasChanges: true,
			diffs: [
				{
					changedFiles: [],
					unchangedFiles: [],
					deletedFiles: ["removed.ts"],
				},
			],
		};

		await validateGeneratedOutput(ctx, baseParams);

		expect(runValidation).toHaveBeenCalledWith({
			files: [path.join(tempGenerated, "remaining.ts")],
			lintDirs: [tempGenerated],
		});
	});

	it("TC-UT-LIFT-003c: should skip validation when --skip-validate is enabled", async () => {
		isValidationSkipped.mockReturnValue(true);
		const ctx: LifecycleCtx = {
			hasChanges: true,
			diffs: [
				{
					changedFiles: ["a.ts"],
					unchangedFiles: [],
					deletedFiles: [],
				},
			],
		};

		await validateGeneratedOutput(ctx, baseParams);

		expect(runValidation).not.toHaveBeenCalled();
	});

	// ══════════════════════════════════════════════════════════════
	// TC-UT-LIFT-004: diffTempVsOutput calls computeDiff for each output dir
	// ══════════════════════════════════════════════════════════════
	it("TC-UT-LIFT-004: should call computeDiff for each output directory", async () => {
		// Arrange
		fs.mkdirSync(
			path.join(WORKSPACE_ROOT, ".temp", "123-abc", "src/generated"),
			{ recursive: true },
		);
		fs.mkdirSync(path.join(WORKSPACE_ROOT, ".temp", "123-abc", "src/types"), {
			recursive: true,
		});
		fs.mkdirSync(path.join(WORKSPACE_ROOT, "src/generated"), {
			recursive: true,
		});
		fs.mkdirSync(path.join(WORKSPACE_ROOT, "src/types"), { recursive: true });

		const ctx = { hasChanges: false };
		const params: LifecycleTaskParams<unknown, unknown> = {
			...baseParams,
			outputDirs: ["src/generated", "src/types"],
		};

		computeDiff.mockReturnValue({
			changedFiles: [],
			unchangedFiles: ["a.ts"],
			deletedFiles: [],
		});

		// Act
		await diffTempVsOutput(
			ctx as Parameters<typeof diffTempVsOutput>[0],
			params,
		);

		// Assert
		expect(computeDiff).toHaveBeenCalledTimes(2);
	});

	// ══════════════════════════════════════════════════════════════
	// TC-UT-LIFT-005: diffTempVsOutput sets hasChanges=true when files changed
	// ══════════════════════════════════════════════════════════════
	it("TC-UT-LIFT-005: should set hasChanges to true when changed files are detected", async () => {
		// Arrange
		fs.mkdirSync(
			path.join(WORKSPACE_ROOT, ".temp", "123-abc", "src/generated"),
			{ recursive: true },
		);
		fs.mkdirSync(path.join(WORKSPACE_ROOT, "src/generated"), {
			recursive: true,
		});

		const ctx = { hasChanges: false, diffs: [] as unknown[] };
		computeDiff.mockReturnValue({
			changedFiles: ["a.ts", "b.ts"],
			unchangedFiles: [],
			deletedFiles: [],
		});

		// Act
		await diffTempVsOutput(
			ctx as Parameters<typeof diffTempVsOutput>[0],
			baseParams,
		);

		// Assert
		expect(ctx.hasChanges).toBe(true);
	});

	// ══════════════════════════════════════════════════════════════
	// TC-UT-LIFT-006: diffTempVsOutput sets hasChanges=true when files deleted
	// ══════════════════════════════════════════════════════════════
	it("TC-UT-LIFT-006: should set hasChanges to true when deleted files are detected", async () => {
		// Arrange
		fs.mkdirSync(
			path.join(WORKSPACE_ROOT, ".temp", "123-abc", "src/generated"),
			{ recursive: true },
		);
		fs.mkdirSync(path.join(WORKSPACE_ROOT, "src/generated"), {
			recursive: true,
		});

		const ctx = { hasChanges: false, diffs: [] as unknown[] };
		computeDiff.mockReturnValue({
			changedFiles: [],
			unchangedFiles: [],
			deletedFiles: ["c.ts"],
		});

		// Act
		await diffTempVsOutput(
			ctx as Parameters<typeof diffTempVsOutput>[0],
			baseParams,
		);

		// Assert
		expect(ctx.hasChanges).toBe(true);
	});

	// ══════════════════════════════════════════════════════════════
	// TC-UT-LIFT-007: handleNoChanges calls cleanupTempSessionDir
	// ══════════════════════════════════════════════════════════════
	it("TC-UT-LIFT-007: should call cleanupTempSessionDir and onReportReady when no changes", async () => {
		// Arrange
		fs.mkdirSync(path.join(WORKSPACE_ROOT, ".temp", "123-abc"), {
			recursive: true,
		});
		const ctx = { hasChanges: false, diffs: [] };

		// Act
		await handleNoChanges(
			ctx as Parameters<typeof handleNoChanges>[0],
			baseParams,
		);

		// Assert
		expect(cleanupTempSessionDir).toHaveBeenCalledWith(baseParams.tempDir);
		expect(baseParams.onReportReady).toHaveBeenCalledWith({
			label: baseParams.label,
			hasChanges: false,
			reports: baseParams.context.reports,
		});
	});

	// ══════════════════════════════════════════════════════════════
	// TC-UT-LIFT-008: handleNoChanges writes report markdown when reportsOutputPath is set
	// ══════════════════════════════════════════════════════════════
	it("TC-UT-LIFT-008: should write report markdown file when reportsOutputPath is provided", async () => {
		// Arrange
		fs.mkdirSync(path.join(WORKSPACE_ROOT, ".temp", "123-abc"), {
			recursive: true,
		});
		const ctx = { hasChanges: false, diffs: [] };
		const reportsOutputPath = path.join(
			WORKSPACE_ROOT,
			"reports",
			"pipeline-report.md",
		);
		const params: LifecycleTaskParams<unknown, unknown> = {
			...baseParams,
			reportsOutputPath,
		};

		// Act
		await handleNoChanges(ctx as Parameters<typeof handleNoChanges>[0], params);

		// Assert
		expect(fs.existsSync(path.join(WORKSPACE_ROOT, "reports"))).toBe(true);
		expect(fs.existsSync(reportsOutputPath)).toBe(true);
	});

	// ══════════════════════════════════════════════════════════════
	// TC-UT-LIFT-009: handleNoChanges sets task output with correct format
	// ══════════════════════════════════════════════════════════════
	it("TC-UT-LIFT-009: should set task output with correct summary format", async () => {
		// Arrange
		fs.mkdirSync(path.join(WORKSPACE_ROOT, ".temp", "123-abc"), {
			recursive: true,
		});
		const ctx = {
			hasChanges: false,
			diffs: [
				{
					changedFiles: [],
					unchangedFiles: ["a.ts", "b.ts"],
					deletedFiles: [],
				},
			],
		};

		// Act
		await handleNoChanges(
			ctx as Parameters<typeof handleNoChanges>[0],
			baseParams,
		);

		// Assert
		expect(mockTask.output).toContain("Sem alterações");
		expect(mockTask.output).toContain("inalterado(s)");
	});

	// ══════════════════════════════════════════════════════════════
	// TC-UT-LIFT-010: backupCurrentOutput calls backupDir for each output dir
	// ══════════════════════════════════════════════════════════════
	it("TC-UT-LIFT-010: should call backupDir for each output directory", async () => {
		// Arrange
		fs.mkdirSync(path.join(WORKSPACE_ROOT, "src/generated"), {
			recursive: true,
		});
		fs.mkdirSync(path.join(WORKSPACE_ROOT, "src/types"), { recursive: true });

		const params: LifecycleTaskParams<unknown, unknown> = {
			...baseParams,
			outputDirs: ["src/generated", "src/types"],
		};

		// Act
		await backupCurrentOutput(params);

		// Assert
		expect(backupDir).toHaveBeenCalledTimes(2);
	});

	// ══════════════════════════════════════════════════════════════
	// TC-UT-LIFT-011: swapTempToOutputDirs calls swapTempToOutput for each output dir
	// ══════════════════════════════════════════════════════════════
	it("TC-UT-LIFT-011: should call swapTempToOutput for each output directory", async () => {
		// Arrange
		fs.mkdirSync(
			path.join(WORKSPACE_ROOT, ".temp", "123-abc", "src/generated"),
			{ recursive: true },
		);
		fs.mkdirSync(path.join(WORKSPACE_ROOT, ".temp", "123-abc", "src/types"), {
			recursive: true,
		});
		fs.mkdirSync(path.join(WORKSPACE_ROOT, "src/generated"), {
			recursive: true,
		});
		fs.mkdirSync(path.join(WORKSPACE_ROOT, "src/types"), { recursive: true });

		const params: LifecycleTaskParams<unknown, unknown> = {
			...baseParams,
			outputDirs: ["src/generated", "src/types"],
		};

		// Act
		await swapTempToOutputDirs(params);

		// Assert
		expect(swapTempToOutput).toHaveBeenCalledTimes(2);
		expect(cleanupTempSessionDir).toHaveBeenCalledWith(params.tempDir);
	});

	// ══════════════════════════════════════════════════════════════
	// TC-UT-LIFT-012: swapTempToOutputDirs skips non-existent temp directories
	// ══════════════════════════════════════════════════════════════
	it("TC-UT-LIFT-012: should skip swap for non-existent temp output directories", async () => {
		// Arrange - temp dir exists but doesn't have the src/generated subdir
		fs.mkdirSync(path.join(WORKSPACE_ROOT, ".temp", "123-abc"), {
			recursive: true,
		});
		fs.mkdirSync(path.join(WORKSPACE_ROOT, "src/generated"), {
			recursive: true,
		});

		// Act
		await swapTempToOutputDirs(baseParams);

		// Assert
		expect(swapTempToOutput).not.toHaveBeenCalled();
		expect(cleanupTempSessionDir).toHaveBeenCalled(); // but cleanup is still called
	});

	// ══════════════════════════════════════════════════════════════
	// TC-UT-LIFT-013: renderReportsSummary calls onReportReady with correct data
	// ══════════════════════════════════════════════════════════════
	it("TC-UT-LIFT-013: should call onReportReady with hasChanges=true", async () => {
		// Arrange
		fs.mkdirSync(path.join(WORKSPACE_ROOT, ".temp", "123-abc"), {
			recursive: true,
		});
		const ctx = { hasChanges: true, diffs: [] };

		// Act
		await renderReportsSummary(
			ctx as Parameters<typeof renderReportsSummary>[0],
			baseParams,
		);

		// Assert
		expect(baseParams.onReportReady).toHaveBeenCalledWith({
			label: baseParams.label,
			hasChanges: true,
			reports: baseParams.context.reports,
		});
	});

	// ══════════════════════════════════════════════════════════════
	// TC-UT-LIFT-014: renderReportsSummary writes report markdown when reportsOutputPath is set
	// ══════════════════════════════════════════════════════════════
	it("TC-UT-LIFT-014: should write report markdown file when reportsOutputPath is provided", async () => {
		// Arrange
		fs.mkdirSync(path.join(WORKSPACE_ROOT, ".temp", "123-abc"), {
			recursive: true,
		});
		const ctx = { hasChanges: true, diffs: [] };
		const reportsOutputPath = path.join(
			WORKSPACE_ROOT,
			"reports",
			"pipeline-report.md",
		);
		const params: LifecycleTaskParams<unknown, unknown> = {
			...baseParams,
			reportsOutputPath,
		};

		// Act
		await renderReportsSummary(
			ctx as Parameters<typeof renderReportsSummary>[0],
			params,
		);

		// Assert
		expect(fs.existsSync(path.join(WORKSPACE_ROOT, "reports"))).toBe(true);
		expect(fs.existsSync(reportsOutputPath)).toBe(true);
	});

	// ══════════════════════════════════════════════════════════════
	// TC-UT-LIFT-015: renderReportsSummary sets task output with correct format
	// ══════════════════════════════════════════════════════════════
	it("TC-UT-LIFT-015: should set task output with correct summary for changed files", async () => {
		// Arrange
		fs.mkdirSync(path.join(WORKSPACE_ROOT, ".temp", "123-abc"), {
			recursive: true,
		});
		const ctx = {
			hasChanges: true,
			diffs: [
				{
					changedFiles: ["a.ts", "b.ts"],
					unchangedFiles: ["c.ts"],
					deletedFiles: ["d.ts"],
				},
			],
		};

		// Act
		await renderReportsSummary(
			ctx as Parameters<typeof renderReportsSummary>[0],
			baseParams,
		);

		// Assert
		expect(mockTask.output).toContain("alterado(s)");
		expect(mockTask.output).toContain("removido(s)");
		expect(mockTask.output).toContain("inalterado(s)");
	});

	// ══════════════════════════════════════════════════════════════
	// TC-UT-LIFT-016: Task output matches expected Listr2 format
	// ══════════════════════════════════════════════════════════════
	it("TC-UT-LIFT-017: should record an empty diff when temp output is missing", async () => {
		fs.mkdirSync(path.join(WORKSPACE_ROOT, ".temp", "123-abc"), {
			recursive: true,
		});
		fs.mkdirSync(path.join(WORKSPACE_ROOT, "src/generated"), {
			recursive: true,
		});

		const ctx = { hasChanges: false };
		await diffTempVsOutput(
			ctx as Parameters<typeof diffTempVsOutput>[0],
			baseParams,
		);

		expect(ctx).toMatchObject({
			hasChanges: false,
			diffs: [{ changedFiles: [], unchangedFiles: [], deletedFiles: [] }],
		});
		expect(computeDiff).not.toHaveBeenCalled();
	});

	it("TC-UT-LIFT-018: should skip report persistence when callbacks are absent", async () => {
		fs.mkdirSync(path.join(WORKSPACE_ROOT, ".temp", "123-abc"), {
			recursive: true,
		});
		const params: LifecycleTaskParams<unknown, unknown> = {
			...baseParams,
			onReportReady: undefined,
			reportsOutputPath: undefined,
		};

		await handleNoChanges(
			{ hasChanges: false, diffs: [] } as Parameters<typeof handleNoChanges>[0],
			params,
		);

		expect(mockTask.output).toContain("Sem alterações");
		expect(renderReportsMarkdown).not.toHaveBeenCalled();
	});

	it("TC-UT-LIFT-019: should summarize only unchanged files when nothing changed", async () => {
		fs.mkdirSync(path.join(WORKSPACE_ROOT, ".temp", "123-abc"), {
			recursive: true,
		});
		const ctx = {
			hasChanges: true,
			diffs: [
				{
					changedFiles: [],
					unchangedFiles: ["only.ts"],
					deletedFiles: [],
				},
			],
		};

		await renderReportsSummary(
			ctx as Parameters<typeof renderReportsSummary>[0],
			baseParams,
		);

		expect(mockTask.output).toBe("1 inalterado(s), 0 report(s)");
	});

	it("TC-UT-LIFT-016: should set task.output as a string for Listr2 renderer", async () => {
		// Arrange
		fs.mkdirSync(path.join(WORKSPACE_ROOT, ".temp", "123-abc"), {
			recursive: true,
		});
		const ctx = {
			hasChanges: true,
			diffs: [{ changedFiles: ["x.ts"], unchangedFiles: [], deletedFiles: [] }],
		};

		// Act
		await renderReportsSummary(
			ctx as Parameters<typeof renderReportsSummary>[0],
			baseParams,
		);

		// Assert
		expect(typeof mockTask.output).toBe("string");
		expect(mockTask.output).toMatch(/\d+ alterado\(s\)/);
	});

	it("TC-UT-LIFT-020: should build a null plan when hasChanges but diffs is missing", async () => {
		// Garante que a validação NÃO está pulada (mock pode ter sido setado true antes)
		isValidationSkipped.mockReturnValue(false);
		// ctx.hasChanges=true e ctx.diffs indefinido → collectValidationPlan retorna null
		const ctx: LifecycleCtx = {
			hasChanges: true,
		};

		await validateGeneratedOutput(ctx, baseParams);

		expect(runValidation).not.toHaveBeenCalled();
	});

	it("TC-UT-LIFT-021: should build a lint-only plan when only non-TS files change", async () => {
		// Garante que a validação NÃO está pulada (mock pode ter sido setado true antes)
		isValidationSkipped.mockReturnValue(false);
		const tempGenerated = path.join(
			WORKSPACE_ROOT,
			".temp",
			"123-abc",
			"src/generated",
		);
		fs.mkdirSync(tempGenerated, { recursive: true });
		fs.writeFileSync(path.join(tempGenerated, "a.txt"), "not a ts file\n");

		const ctx: LifecycleCtx = {
			hasChanges: true,
			diffs: [
				{
					changedFiles: ["a.txt"],
					unchangedFiles: [],
					deletedFiles: [],
				},
			],
		};

		await validateGeneratedOutput(ctx, baseParams);

		// Nenhum arquivo .ts, mas diretório temp existe → plan apenas com lintDirs
		expect(runValidation).toHaveBeenCalledWith({
			files: [],
			lintDirs: [tempGenerated],
		});
	});

	it("TC-UT-LIFT-022: should write diff-debug report when diff-debug is enabled", async () => {
		// Habilita o modo de diagnóstico real (módulo não mockado)
		setDiffDebug(true);

		const tempGenerated = path.join(
			WORKSPACE_ROOT,
			".temp",
			"123-abc",
			"src/generated",
		);
		fs.mkdirSync(tempGenerated, { recursive: true });
		fs.writeFileSync(path.join(tempGenerated, "a.ts"), "export const a = 1;\n");

		const ctx = { hasChanges: false, diffs: [] as unknown[] };
		computeDiff.mockReturnValue({
			changedFiles: ["a.ts"],
			unchangedFiles: [],
			deletedFiles: [],
		});

		await diffTempVsOutput(
			ctx as Parameters<typeof diffTempVsOutput>[0],
			baseParams,
		);

		// O bloco de diff-debug escreve o relatório em .reports/generate-types
		expect(ctx.hasChanges).toBe(true);
		expect(
			fs.existsSync(
				path.join(
					WORKSPACE_ROOT,
					".reports",
					"generate-types",
					"diff-debug.txt",
				),
			),
		).toBe(true);
	});
});
