import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	mock,
	vi,
} from "bun:test";

// Mock node:fs before importing lifecycle
mock.module("node:fs", () => ({
	...import.meta.require("node:fs"),
	mkdirSync: vi.fn(),
	existsSync: vi.fn(() => true),
	writeFileSync: vi.fn(),
	rmSync: vi.fn(),
	readFileSync: vi.fn(),
	readdirSync: vi.fn(() => []),
	copyFileSync: vi.fn(),
}));

// Mock the @generators path aliases
mock.module("@generators/io/locker", () => ({
	applyWorkspaceLockIfNeeded: vi.fn(),
}));

mock.module("@generators/pipeline/runner", () => ({
	runPipelineStages: vi.fn(),
}));

mock.module("@generators/cli/flags", () => ({
	isValidationSkipped: vi.fn(() => false),
	setValidationSkipped: vi.fn(),
	isDiffDebug: vi.fn(() => false),
	setDiffDebug: vi.fn(),
}));

mock.module("./lifecycle-tasks", () => ({
	diffTempVsOutput: vi.fn(),
	handleNoChanges: vi.fn(),
	renderDiffSummary: vi.fn(),
	swapTempToOutputDirs: vi.fn(),
	validateGeneratedOutput: vi.fn(),
}));

// Import mocked functions for assertions
import * as fs from "node:fs";
import { isValidationSkipped } from "@generators/cli/flags";
import { applyWorkspaceLockIfNeeded } from "@generators/io/locker";
import { runPipelineStages } from "@generators/pipeline/runner";
import type { TaskRunner } from "@generators/types";
import { runStandardPipeline } from "./lifecycle";
import {
	diffTempVsOutput,
	handleNoChanges,
	renderDiffSummary,
	swapTempToOutputDirs,
	validateGeneratedOutput,
} from "./lifecycle-tasks";

describe("lifecycle", () => {
	beforeEach(() => {
		vi.clearAllMocks();

		// Default mock implementations
		applyWorkspaceLockIfNeeded.mockImplementation(() => {});
		runPipelineStages.mockReturnValue(undefined);
		validateGeneratedOutput.mockResolvedValue(undefined);
		diffTempVsOutput.mockResolvedValue(undefined);
		handleNoChanges.mockResolvedValue(undefined);
		swapTempToOutputDirs.mockResolvedValue(undefined);
		renderDiffSummary.mockResolvedValue(undefined);
		fs.mkdirSync.mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	// TC-UT-LIF-001: Empty outputDirs skips lock/stages/validation
	it("TC-UT-LIF-001: should skip lock and stages when outputDirs is empty array", () => {
		// Arrange
		const mockTask = {
			newListr: vi.fn().mockReturnValue({}),
		};

		const options = {
			task: mockTask as unknown as TaskRunner,
			outputDirs: [],
			stages: [],
		};

		// Act
		runStandardPipeline(options);

		// Assert
		expect(mockTask.newListr).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({
					title: "Pipeline",
				}),
			]),
			expect.any(Object),
		);
		// Should NOT call lock when outputDirs is empty
		expect(applyWorkspaceLockIfNeeded).not.toHaveBeenCalled();
	});

	// TC-UT-LIF-002: Full clean run executes lock → stages → diff → validate → no changes
	it("TC-UT-LIF-002: should execute lock, stages, diff, validate when no changes detected", () => {
		// Arrange
		const mockTask = {
			newListr: vi.fn().mockReturnValue({}),
		};

		diffTempVsOutput.mockImplementation(async (ctx) => {
			ctx.hasChanges = false;
			ctx.diffs = [];
		});

		const options = {
			task: mockTask as unknown as TaskRunner,
			outputDirs: ["packages/generated"],
			stages: [],
		};

		// Act
		runStandardPipeline(options);

		// Assert - verify the Listr task structure includes all lifecycle stages
		expect(mockTask.newListr).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({
					title: "Bloqueando workspace para saídas geradas",
				}),
				expect.objectContaining({ title: "Pipeline" }),
				expect.objectContaining({ title: "Comparando alterações" }),
				expect.objectContaining({ title: "Validando saída gerada" }),
				expect.objectContaining({ title: "Sem alterações" }),
			]),
			expect.any(Object),
		);

		// Lock should be set up (call verified via task structure)
		expect(mockTask.newListr).toHaveBeenCalled();
	});

	// TC-UT-LIF-003: Changes detected → swap → diff summary
	it("TC-UT-LIF-003: should execute swap and renderDiffSummary when changes are detected", () => {
		// Arrange
		const mockTask = {
			newListr: vi.fn().mockReturnValue({}),
		};

		diffTempVsOutput.mockImplementation(async (ctx) => {
			ctx.hasChanges = true;
			ctx.diffs = [
				{ changedFiles: ["a.ts"], unchangedFiles: [], deletedFiles: [] },
			];
		});

		const options = {
			task: mockTask as unknown as TaskRunner,
			outputDirs: ["packages/generated"],
			stages: [],
		};

		// Act
		runStandardPipeline(options);

		// Assert - verify task structure has skip functions for conditional tasks
		const callArgs = mockTask.newListr.mock.calls[0][0] as Array<{
			title: string;
			skip?: (ctx: unknown) => string | boolean;
		}>;

		// No changes task should be skipped when hasChanges is true
		const noChangesTask = callArgs.find((t) => t.title === "Sem alterações");
		expect(noChangesTask?.skip).toBeDefined();

		// Swap task should NOT be skipped when hasChanges is true
		const swapTask = callArgs.find((t) => t.title === "Aplicando alterações");
		expect(swapTask?.skip).toBeDefined();
		expect(swapTask?.skip?.({ hasChanges: true })).toBe(false);
	});

	// TC-UT-LIF-004: No-changes scenario has correct skip logic
	it("TC-UT-LIF-004: should skip swap task when no changes are detected", () => {
		// Arrange
		const mockTask = {
			newListr: vi.fn().mockReturnValue({}),
		};

		diffTempVsOutput.mockImplementation(async (ctx) => {
			ctx.hasChanges = false;
			ctx.diffs = [];
		});

		const options = {
			task: mockTask as unknown as TaskRunner,
			outputDirs: ["packages/generated"],
			stages: [],
		};

		// Act
		runStandardPipeline(options);

		// Assert - verify skip logic for no-changes scenario
		const callArgs = mockTask.newListr.mock.calls[0][0] as Array<{
			title: string;
			skip?: (ctx: unknown) => string | boolean;
		}>;

		// No changes task should NOT be skipped (hasChanges=false)
		const noChangesTask = callArgs.find((t) => t.title === "Sem alterações");
		expect(noChangesTask?.skip?.({ hasChanges: false })).toBe(false);

		// Swap task should be skipped when hasChanges is false
		const swapTask = callArgs.find((t) => t.title === "Aplicando alterações");
		expect(swapTask?.skip?.({ hasChanges: false })).toBe("Sem alterações");
	});

	// TC-UT-LIF-005: Validation task is present with correct title
	it("TC-UT-LIF-005: should include validation task in lifecycle", () => {
		// Arrange
		const mockTask = {
			newListr: vi.fn().mockReturnValue({}),
		};

		const options = {
			task: mockTask as unknown as TaskRunner,
			outputDirs: ["packages/generated"],
			stages: [],
		};

		// Act
		runStandardPipeline(options);

		// Assert - validation task is in the task list
		const callArgs = mockTask.newListr.mock.calls[0][0] as Array<{
			title: string;
		}>;
		const validationTask = callArgs.find(
			(t) => t.title === "Validando saída gerada",
		) as { skip?: (ctx: unknown) => string | boolean } | undefined;
		expect(validationTask).toBeDefined();
		expect(validationTask?.skip?.({ hasChanges: false })).toBe(
			"Sem alterações",
		);
		expect(validationTask?.skip?.({ hasChanges: true })).toBe(false);
	});

	// TC-UT-LIF-015: Validation task is skipped when --skip-validate is enabled
	it("TC-UT-LIF-015: should skip validation task when validation is globally skipped", () => {
		// Arrange
		const mockTask = {
			newListr: vi.fn().mockReturnValue({}),
		};

		isValidationSkipped.mockReturnValue(true);

		const options = {
			task: mockTask as unknown as TaskRunner,
			outputDirs: ["packages/generated"],
			stages: [],
		};

		// Act
		runStandardPipeline(options);

		// Assert - validation task skip returns the skip message
		const callArgs = mockTask.newListr.mock.calls[0][0] as Array<{
			title: string;
			skip?: (ctx: { hasChanges: boolean }) => string | boolean;
		}>;
		const validationTask = callArgs.find(
			(t) => t.title === "Validando saída gerada",
		);
		expect(validationTask).toBeDefined();
		expect(validationTask?.skip?.({ hasChanges: true })).toBe(
			"Validação desabilitada (--skip-validate)",
		);
		expect(isValidationSkipped).toHaveBeenCalled();
	});

	// TC-UT-LIF-016: Validation task invokes validateGeneratedOutput when not skipped
	it("TC-UT-LIF-016: should call validateGeneratedOutput when validation runs", async () => {
		// Arrange
		const mockTask = {
			newListr: vi.fn().mockReturnValue({}),
		};

		isValidationSkipped.mockReturnValue(false);

		runStandardPipeline({
			task: mockTask as unknown as TaskRunner,
			outputDirs: ["packages/generated"],
			stages: [],
		});

		const tasks = getLifecycleTasks(mockTask);
		await runLifecycleTask(tasks, "Validando saída gerada", {
			hasChanges: true,
			diffs: [],
		});

		expect(validateGeneratedOutput).toHaveBeenCalledWith(
			expect.objectContaining({ hasChanges: true }),
			expect.anything(),
		);
	});

	// TC-UT-LIF-006: Lock task has async task function
	it("TC-UT-LIF-006: should include async lock task in lifecycle", () => {
		// Arrange
		const mockTask = {
			newListr: vi.fn().mockReturnValue({}),
		};

		const options = {
			task: mockTask as unknown as TaskRunner,
			outputDirs: ["packages/generated"],
			stages: [],
		};

		// Act
		runStandardPipeline(options);

		// Assert - lock task is present
		const callArgs = mockTask.newListr.mock.calls[0][0] as Array<{
			title: string;
			task: unknown;
		}>;
		const lockTask = callArgs.find(
			(t) => t.title === "Bloqueando workspace para saídas geradas",
		);
		expect(lockTask).toBeDefined();
		// Lock task should have an async task function
		expect(typeof lockTask?.task).toBe("function");
	});

	// TC-UT-LIF-008: Pipeline creates temp directory
	it("TC-UT-LIF-008: should create temp directory when outputDirs is not empty", () => {
		// Arrange
		const mockTask = {
			newListr: vi.fn().mockReturnValue({}),
		};

		const options = {
			task: mockTask as unknown as TaskRunner,
			outputDirs: ["packages/generated"],
			stages: [],
		};

		// Act
		runStandardPipeline(options);

		// Assert - verify mkdirSync was called with .temp path
		expect(fs.mkdirSync).toHaveBeenCalledWith(
			expect.stringContaining(".temp"),
			expect.objectContaining({ recursive: true }),
		);
	});

	// TC-UT-LIF-009: Pipeline task structure includes runPipelineStages call
	it("TC-UT-LIF-009: should include Pipeline task that calls runPipelineStages", () => {
		// Arrange
		const mockTask = {
			newListr: vi.fn().mockReturnValue({}),
		};

		const options = {
			task: mockTask as unknown as TaskRunner,
			outputDirs: ["packages/generated"],
			stages: [],
		};

		// Act
		runStandardPipeline(options);

		// Assert - verify the Pipeline task exists in the task list
		const callArgs = mockTask.newListr.mock.calls[0][0] as Array<{
			title: string;
			task: unknown;
		}>;
		const pipelineTask = callArgs.find((t) => t.title === "Pipeline");
		expect(pipelineTask).toBeDefined();
		// Pipeline task should have a task function that calls runPipelineStages
		expect(typeof pipelineTask?.task).toBe("function");
	});

	type ListrTaskDef = {
		title: string;
		skip?: (ctx: { hasChanges: boolean }) => string | boolean;
		task: (
			ctx: { hasChanges: boolean; diffs?: unknown[] },
			subTask?: TaskRunner,
		) => Promise<void> | ReturnType<TaskRunner["newListr"]>;
	};

	function getLifecycleTasks(mockTask: { newListr: ReturnType<typeof vi.fn> }) {
		return mockTask.newListr.mock.calls[0][0] as ListrTaskDef[];
	}

	async function runLifecycleTask(
		tasks: ListrTaskDef[],
		title: string,
		ctx: { hasChanges: boolean; diffs?: unknown[] },
		subTask?: TaskRunner,
	) {
		const taskDef = tasks.find((t) => t.title === title);
		expect(taskDef).toBeDefined();
		const skip = taskDef?.skip?.(ctx);
		if (skip !== false && skip !== undefined) {
			return;
		}
		await taskDef?.task(ctx, subTask);
	}

	// TC-UT-LIF-011: task handlers invoke lock, pipeline, validate, diff, and no-changes paths
	it("TC-UT-LIF-011: should run lifecycle task handlers end-to-end when outputDirs exist", async () => {
		const mockSubTask = { newListr: vi.fn() } as unknown as TaskRunner;
		const mockTask = {
			newListr: vi.fn().mockReturnValue({}),
		};

		diffTempVsOutput.mockImplementation(async (ctx) => {
			ctx.hasChanges = false;
			ctx.diffs = [];
		});

		const options = {
			task: mockTask as unknown as TaskRunner,
			outputDirs: ["packages/generated"],
			stages: [],
		};

		runStandardPipeline(options);
		const tasks = getLifecycleTasks(mockTask);
		const ctx = { hasChanges: false, diffs: [] as unknown[] };

		await runLifecycleTask(
			tasks,
			"Bloqueando workspace para saídas geradas",
			ctx,
		);
		expect(applyWorkspaceLockIfNeeded).toHaveBeenCalledWith(
			["packages/generated"],
			true,
		);

		await runLifecycleTask(tasks, "Pipeline", ctx, mockSubTask);
		expect(runPipelineStages).toHaveBeenCalled();

		await runLifecycleTask(tasks, "Comparando alterações", ctx);
		expect(diffTempVsOutput).toHaveBeenCalled();

		await runLifecycleTask(tasks, "Validando saída gerada", ctx);
		expect(validateGeneratedOutput).not.toHaveBeenCalled();

		await runLifecycleTask(tasks, "Sem alterações", ctx);
		expect(handleNoChanges).toHaveBeenCalled();
	});

	// TC-UT-LIF-012: swap and diff summary run when changes are detected
	it("TC-UT-LIF-012: should run swap and diff summary tasks when hasChanges is true", async () => {
		const mockTask = {
			newListr: vi.fn().mockReturnValue({}),
		};

		diffTempVsOutput.mockImplementation(async (ctx) => {
			ctx.hasChanges = true;
			ctx.diffs = [
				{ changedFiles: ["a.ts"], unchangedFiles: [], deletedFiles: [] },
			];
		});

		runStandardPipeline({
			task: mockTask as unknown as TaskRunner,
			outputDirs: ["packages/generated"],
			stages: [],
		});

		const tasks = getLifecycleTasks(mockTask);
		const ctx = { hasChanges: true, diffs: [] as unknown[] };

		await runLifecycleTask(tasks, "Comparando alterações", ctx);
		await runLifecycleTask(tasks, "Aplicando alterações", ctx);
		await runLifecycleTask(tasks, "Resumo de alterações", ctx);

		expect(swapTempToOutputDirs).toHaveBeenCalled();
		expect(renderDiffSummary).toHaveBeenCalled();
	});

	// TC-UT-LIF-013: empty outputDirs pipeline task invokes runPipelineStages
	it("TC-UT-LIF-013: should invoke runPipelineStages when outputDirs is empty", async () => {
		const mockSubTask = { newListr: vi.fn() } as unknown as TaskRunner;
		const mockTask = {
			newListr: vi.fn().mockReturnValue({}),
		};

		runStandardPipeline({
			task: mockTask as unknown as TaskRunner,
			outputDirs: [],
			stages: [],
		});

		const tasks = getLifecycleTasks(mockTask);
		await runLifecycleTask(
			tasks,
			"Pipeline",
			{ hasChanges: false },
			mockSubTask,
		);

		expect(runPipelineStages).toHaveBeenCalled();
	});

	// TC-UT-LIF-014: skip functions return expected messages when hasChanges is true
	it("TC-UT-LIF-014: should skip no-changes task when changes are detected", () => {
		const mockTask = {
			newListr: vi.fn().mockReturnValue({}),
		};

		runStandardPipeline({
			task: mockTask as unknown as TaskRunner,
			outputDirs: ["packages/generated"],
			stages: [],
		});

		const tasks = getLifecycleTasks(mockTask);
		const noChangesTask = tasks.find((t) => t.title === "Sem alterações");
		expect(noChangesTask?.skip?.({ hasChanges: true })).toBe(
			"Sem alterações detectadas",
		);
	});
});
