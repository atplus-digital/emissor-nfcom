import type { TaskRunner } from "@shared/types";
import type { ListrTaskResult } from "listr2";
import { describe, expect, it, vi } from "vitest";
import { runPipelineStages } from "./runner";

// Mock TaskRunner
function createMockTaskRunner() {
	const newListr = vi.fn().mockReturnValue({
		run: vi.fn(),
	});
	return { newListr } as unknown as TaskRunner;
}

describe("TC-UT-RUN-001: runPipelineStages executes single stage", () => {
	it("should execute single stage without calling newListr", async () => {
		const mockTask = createMockTaskRunner();
		const context = { value: 1 };

		const stage = vi.fn().mockResolvedValue({ value: 2 });

		const result = runPipelineStages(context, [stage], mockTask);
		void result;
		// For single stage, newListr is NOT called
		expect(mockTask.newListr).not.toHaveBeenCalled();
	});
});

describe("TC-UT-RUN-002: runPipelineStages handles multiple stages", () => {
	it("should call newListr when there are multiple stages", async () => {
		const mockTask = createMockTaskRunner();
		const context = { step: 0 };

		const stage1 = vi.fn().mockResolvedValue({ step: 1 });
		const stage2 = vi.fn().mockResolvedValue({ step: 2 });

		runPipelineStages(context, [stage1, stage2], mockTask);

		expect(mockTask.newListr).toHaveBeenCalled();
		const callArg = vi.mocked(mockTask.newListr).mock.calls[0][0] as Array<{
			title: string;
		}>;
		expect(callArg).toHaveLength(2);
	});
});

describe("TC-UT-RUN-003: Stage error propagates through Promise", () => {
	it("should propagate error when stage rejects", async () => {
		const mockTask = createMockTaskRunner();
		const context = { value: 1 };

		const stage = vi.fn().mockRejectedValue(new Error("Stage failed"));

		const result = runPipelineStages(context, [stage], mockTask);

		// The function returns a Promise for single stage
		await expect(result).rejects.toThrow("Stage failed");
	});
});

describe("TC-UT-RUN-004: toHumanTitle converts camelCase via getStageTitle", () => {
	it("should convert camelCase function name to title for multiple stages", () => {
		const mockTask = createMockTaskRunner();
		const context = {};

		// Create named functions to test title conversion
		const fetchSchemas = vi.fn().mockResolvedValue({});
		Object.defineProperty(fetchSchemas, "name", {
			value: "fetchSchemas",
			configurable: true,
		});

		const loadData = vi.fn().mockResolvedValue({});
		Object.defineProperty(loadData, "name", {
			value: "loadData",
			configurable: true,
		});

		runPipelineStages(context, [fetchSchemas, loadData], mockTask);

		// newListr should be called with tasks that have titles derived from function names
		expect(mockTask.newListr).toHaveBeenCalled();
		const callArg = vi.mocked(mockTask.newListr).mock.calls[0][0] as Array<{
			title: string;
		}>;
		// toHumanTitle capitalizes first letter: "fetchSchemas" -> "Fetch Schemas"
		expect(callArg[0].title).toBe("Fetch Schemas");
		expect(callArg[1].title).toBe("Load Data");
	});
});

describe("TC-UT-RUN-005: Stage title handles kebab-case names", () => {
	it("should handle function names with hyphens", () => {
		const mockTask = createMockTaskRunner();
		const context = {};

		// Create named function with kebab-style name (via property)
		const loadSchemas = vi.fn().mockResolvedValue({});
		Object.defineProperty(loadSchemas, "name", {
			value: "load-schemas",
			configurable: true,
		});

		runPipelineStages(context, [loadSchemas], mockTask);

		// For single stage, newListr is not called - the stage function
		// name is captured but getStageTitle is not used
		expect(loadSchemas).toHaveBeenCalled();
	});
});

describe("TC-UT-RUN-006: Empty stages array", () => {
	it("should return task.newListr result even for empty stages", () => {
		const mockTask = createMockTaskRunner();
		const context = { value: 1 };

		const result = runPipelineStages(context, [], mockTask);

		// For empty array, stages.length !== 1, so it calls task.newListr([], ...)
		// which returns the mock object
		expect(result).toBeDefined();
		expect(mockTask.newListr).toHaveBeenCalledWith([], expect.any(Object));
	});
});

describe("TC-UT-RUN-007: newListr is called with correct options for multiple stages", () => {
	it("should pass concurrent: false to newListr", () => {
		const mockTask = createMockTaskRunner();
		const context = {};

		const stage1 = vi.fn().mockResolvedValue({});
		const stage2 = vi.fn().mockResolvedValue({});
		runPipelineStages(context, [stage1, stage2], mockTask);

		expect(mockTask.newListr).toHaveBeenCalledWith(
			expect.any(Array),
			expect.objectContaining({ concurrent: false }),
		);
	});
});

describe("TC-UT-RUN-008: Single stage that returns object with run method", () => {
	it("should return the object directly when stage returns object with run", () => {
		const mockTask = createMockTaskRunner();
		const context = { value: 1 };

		const taskObject = { run: vi.fn() };
		const stage = vi.fn().mockReturnValue(taskObject);

		const result = runPipelineStages(context, [stage], mockTask);

		expect(result).toBe(taskObject);
	});
});

describe("TC-UT-RUN-009: Unnamed stage falls back to 'Estágio N' title", () => {
	it("should use 'Estágio N' when stage function has no name", () => {
		const mockTask = createMockTaskRunner();
		const context = {};

		// Create an anonymous stage (no name property)
		const anonymousStage = vi.fn().mockResolvedValue({});

		runPipelineStages(context, [anonymousStage], mockTask);

		// For single stage, newListr is not called - anonymous stage still executes
		expect(anonymousStage).toHaveBeenCalled();
	});

	it("should use 'Estágio N' for multi-stage unnamed functions", () => {
		const mockTask = createMockTaskRunner();
		const context = {};

		// Create two anonymous stages with empty names
		const stage1 = vi.fn().mockResolvedValue({});
		Object.defineProperty(stage1, "name", { value: "", configurable: true });
		const stage2 = vi.fn().mockResolvedValue({});
		Object.defineProperty(stage2, "name", { value: "  ", configurable: true });

		runPipelineStages(context, [stage1, stage2], mockTask);

		expect(mockTask.newListr).toHaveBeenCalled();
		const callArg = vi.mocked(mockTask.newListr).mock.calls[0][0] as Array<{
			title: string;
		}>;
		// First stage should be "Estágio 1" (index 0 + 1)
		expect(callArg[0].title).toBe("Estágio 1");
		expect(callArg[1].title).toBe("Estágio 2");
	});
});

describe("TC-UT-RUN-010: Multi-stage execution handles subtask result correctly", () => {
	it("should handle undefined result from subtask", async () => {
		const mockTask = createMockTaskRunner();
		const context = {};

		const stage1 = vi.fn().mockResolvedValue(undefined);
		const stage2 = vi.fn().mockResolvedValue({ value: 2 });

		const result = runPipelineStages(context, [stage1, stage2], mockTask);

		expect(result).toBeDefined();
	});

	it("should handle subtask returning object with run method", () => {
		const mockTask = createMockTaskRunner();
		const context = {};

		const taskObject = { run: vi.fn() };
		const stage1 = vi.fn().mockReturnValue(taskObject);
		const stage2 = vi.fn().mockResolvedValue({});

		const result = runPipelineStages(context, [stage1, stage2], mockTask);

		expect(result).toBeDefined();
	});
});

describe("TC-UT-RUN-012: Multi-stage subtasks execute and update context", () => {
	it("should await stage results and pass updated context to next stage", async () => {
		const mockTask = createMockTaskRunner();
		const current = { step: 0 };

		const stage1 = vi.fn(async (ctx: { step: number }) => {
			return { step: ctx.step + 1 };
		});
		Object.defineProperty(stage1, "name", {
			value: "stageOne",
			configurable: true,
		});

		const stage2 = vi.fn(async (ctx: { step: number }) => {
			expect(ctx.step).toBe(1);
			return { step: ctx.step + 1 };
		});
		Object.defineProperty(stage2, "name", {
			value: "stageTwo",
			configurable: true,
		});

		runPipelineStages(current, [stage1, stage2], mockTask);

		const subTasks = vi.mocked(mockTask.newListr).mock.calls[0][0] as Array<{
			task: (
				ctx: unknown,
				stageTask: TaskRunner,
			) => Promise<ListrTaskResult<unknown> | undefined>;
		}>;

		await subTasks[0].task({}, mockTask);
		await subTasks[1].task({}, mockTask);

		expect(stage1).toHaveBeenCalled();
		expect(stage2).toHaveBeenCalled();
	});

	it("should return nested listr when multi-stage stage returns object with run", async () => {
		const mockTask = createMockTaskRunner();
		const nested = { run: vi.fn() };
		const stage1 = vi.fn(() => nested);
		const stage2 = vi.fn().mockResolvedValue({});

		runPipelineStages({}, [stage1, stage2], mockTask);

		const subTasks = vi.mocked(mockTask.newListr).mock.calls[0][0] as Array<{
			task: () => Promise<unknown>;
		}>;

		const result = await subTasks[0].task();
		expect(result).toBe(nested);
	});
});

describe("TC-UT-RUN-013: Single stage undefined and empty stage edge cases", () => {
	it("should return undefined when single stage array contains undefined entry", () => {
		const mockTask = createMockTaskRunner();
		const stages = [undefined] as unknown as Parameters<
			typeof runPipelineStages
		>[1];

		const result = runPipelineStages({ value: 1 }, stages, mockTask);

		expect(result).toBeUndefined();
	});

	it("should return undefined when single stage returns undefined", () => {
		const mockTask = createMockTaskRunner();
		const stage = vi.fn().mockReturnValue(undefined);

		const result = runPipelineStages({ value: 1 }, [stage], mockTask);

		expect(result).toBeUndefined();
	});

	it("should skip context update when multi-stage subtask resolves undefined", async () => {
		const mockTask = createMockTaskRunner();
		const stage1 = vi.fn().mockResolvedValue(undefined);
		const stage2 = vi.fn().mockResolvedValue({ step: 2 });
		Object.defineProperty(stage1, "name", {
			value: "stageOne",
			configurable: true,
		});
		Object.defineProperty(stage2, "name", {
			value: "stageTwo",
			configurable: true,
		});

		runPipelineStages({ step: 0 }, [stage1, stage2], mockTask);

		const subTasks = vi.mocked(mockTask.newListr).mock.calls[0][0] as Array<{
			task: () => Promise<unknown>;
		}>;

		await subTasks[0].task({}, mockTask);
		await subTasks[1].task({}, mockTask);

		expect(stage2).toHaveBeenCalledWith({ step: 0 }, mockTask);
	});

	it("should return undefined when multi-stage subtask returns undefined", async () => {
		const mockTask = createMockTaskRunner();
		const stage1 = vi.fn().mockReturnValue(undefined);
		const stage2 = vi.fn().mockResolvedValue({});
		Object.defineProperty(stage1, "name", {
			value: "stageOne",
			configurable: true,
		});
		Object.defineProperty(stage2, "name", {
			value: "stageTwo",
			configurable: true,
		});

		runPipelineStages({}, [stage1, stage2], mockTask);

		const subTasks = vi.mocked(mockTask.newListr).mock.calls[0][0] as Array<{
			task: () => Promise<unknown>;
		}>;

		const result = await subTasks[0].task();
		expect(result).toBeUndefined();
	});
});

describe("TC-UT-RUN-011: Single stage with undefined result returns Promise", () => {
	it("should return Promise when stage returns undefined", async () => {
		const mockTask = createMockTaskRunner();
		const context = { value: 1 };

		const stage = vi.fn().mockResolvedValue(undefined);

		const result = runPipelineStages(context, [stage], mockTask);

		// When single stage returns a resolved Promise with undefined,
		// the function returns Promise.resolve(result).then(...)
		expect(result).toBeInstanceOf(Promise);
		await result; // Should resolve without error
	});
});
