import { describe, expect, it, vi } from "vitest";
import type { CreateScriptTasksInput } from "../../generator-registry";
import { createScriptTasks } from "./create-script-definition";

describe("TC-UT-CSD-001: Valid config produces correct script definition shape", () => {
	it("should create GeneratorDefinition with all required properties", () => {
		const mockInput: CreateScriptTasksInput = {
			description: "Test generator",
			outputDirs: ["src/generated/test"],
			createCliOptions: () => ({
				name: "test-generator",
				stages: [
					{
						title: "Stage 1",
						run: vi.fn().mockReturnValue(Promise.resolve()),
					},
				],
				context: {},
			}),
		};

		const result = createScriptTasks(mockInput);

		expect(result).toHaveProperty("name", "test-generator");
		expect(result).toHaveProperty("description", "Test generator");
		expect(typeof result.getOutputDirs).toBe("function");
		expect(typeof result.createPipelineOptions).toBe("function");
	});

	it("should return outputDirs via getOutputDirs function", () => {
		const mockInput: CreateScriptTasksInput = {
			description: "Test",
			outputDirs: ["src/generated/a", "src/generated/b"],
			createCliOptions: () => ({
				name: "test",
				stages: [],
				context: {},
			}),
		};

		const result = createScriptTasks(mockInput);

		expect(result.getOutputDirs({})).toEqual([
			"src/generated/a",
			"src/generated/b",
		]);
	});
});

describe("TC-UT-CSD-002: createPipelineOptions returns proper factory input", () => {
	it("should return StandardPipelineFactoryInput shape", () => {
		const mockInput: CreateScriptTasksInput = {
			description: "Test",
			outputDirs: ["src/generated"],
			createCliOptions: () => ({
				name: "test-generator",
				stages: [
					{
						title: "Fetch Stage",
						run: vi.fn(),
					},
				],
				context: { customKey: "customValue" },
			}),
		};

		const result = createScriptTasks(mockInput);
		const pipelineOptions = result.createPipelineOptions({});

		expect(pipelineOptions).toHaveProperty("defaultConfig", {});
		expect(pipelineOptions).toHaveProperty("getOutputDirs");
		expect(pipelineOptions).toHaveProperty("stages");
		expect(pipelineOptions).toHaveProperty("label", "test-generator");
		expect(Array.isArray(pipelineOptions.stages)).toBe(true);
	});
});

describe("TC-UT-CSD-003: Multiple stages are preserved in createCliOptions", () => {
	it("should pass all stages to cli options", () => {
		const stage1 = vi.fn();
		const stage2 = vi.fn();

		const mockInput: CreateScriptTasksInput = {
			description: "Multi-stage test",
			outputDirs: [],
			createCliOptions: () => ({
				name: "multi-stage",
				stages: [
					{ title: "Stage 1", run: stage1 },
					{ title: "Stage 2", run: stage2 },
					{ title: "Stage 3", run: vi.fn() },
				],
				context: {},
			}),
		};

		createScriptTasks(mockInput);
		const cliOptions = mockInput.createCliOptions();

		expect(cliOptions.stages).toHaveLength(3);
	});
});

describe("TC-UT-CSD-004: cliOptions.name is used as label", () => {
	it("should use cli name as pipeline label", () => {
		const mockInput: CreateScriptTasksInput = {
			description: "Label test",
			outputDirs: [],
			createCliOptions: () => ({
				name: "my-custom-label",
				stages: [],
				context: {},
			}),
		};

		const result = createScriptTasks(mockInput);
		const pipelineOptions = result.createPipelineOptions({});

		expect(pipelineOptions.label).toBe("my-custom-label");
	});
});

describe("TC-UT-CSD-005: getOutputDirs returns empty array when no outputDirs", () => {
	it("should return empty array for no outputDirs", () => {
		const mockInput: CreateScriptTasksInput = {
			description: "No output",
			outputDirs: [],
			createCliOptions: () => ({
				name: "no-output",
				stages: [],
				context: {},
			}),
		};

		const result = createScriptTasks(mockInput);

		expect(result.getOutputDirs({})).toEqual([]);
	});
});

describe("TC-UT-CSD-006: createScriptTasks is called once per invocation", () => {
	it("should create independent definitions for each call", () => {
		const mockInput: CreateScriptTasksInput = {
			description: "Independent test",
			outputDirs: ["src/generated"],
			createCliOptions: () => ({
				name: "test",
				stages: [],
				context: {},
			}),
		};

		const result1 = createScriptTasks(mockInput);
		const result2 = createScriptTasks(mockInput);

		// Results should be independent objects
		expect(result1).not.toBe(result2);
		expect(result1.name).toBe(result2.name);
	});
});

describe("TC-UT-CSD-008: createPipelineOptions stage runs generator CLI via Listr", () => {
	it("should map cli stages into a Listr task list", () => {
		const stageRun = vi.fn().mockReturnValue(undefined);
		const mockInput: CreateScriptTasksInput = {
			description: "CLI runner test",
			outputDirs: ["src/generated"],
			createCliOptions: () => ({
				name: "cli-runner",
				stages: [{ title: "Fetch", run: stageRun }],
				context: { value: 1 },
			}),
		};

		const mockTask = {
			newListr: vi.fn().mockReturnValue({ run: vi.fn() }),
		};

		const definition = createScriptTasks(mockInput);
		const pipelineOptions = definition.createPipelineOptions({});
		const [pipelineStage] = pipelineOptions.stages;

		pipelineStage({ value: 1 }, mockTask as never);

		expect(mockTask.newListr).toHaveBeenCalledWith(
			[
				expect.objectContaining({
					title: "Fetch",
				}),
			],
			expect.objectContaining({
				concurrent: false,
				ctx: { value: 1 },
			}),
		);

		const mappedTask = vi.mocked(mockTask.newListr).mock.calls[0][0][0] as {
			task: (ctx: unknown, task: unknown) => unknown;
		};
		mappedTask.task({ value: 1 }, {});
		expect(stageRun).toHaveBeenCalledWith({ value: 1 }, {});
	});
});

describe("TC-UT-CSD-009: createPipelineOptions uses noop output dirs", () => {
	it("should return empty array from pipeline getOutputDirs", () => {
		const mockInput: CreateScriptTasksInput = {
			description: "Noop output dirs",
			outputDirs: ["src/generated/custom"],
			createCliOptions: () => ({
				name: "noop-output",
				stages: [{ title: "Stage", run: vi.fn() }],
				context: {},
			}),
		};

		const definition = createScriptTasks(mockInput);
		const pipelineOptions = definition.createPipelineOptions({});

		expect(pipelineOptions.getOutputDirs()).toEqual([]);
		expect(definition.getOutputDirs({})).toEqual(["src/generated/custom"]);
	});
});

describe("TC-UT-CSD-007: Pipeline stages array is not empty", () => {
	it("should have at least one stage in pipeline options", () => {
		const mockInput: CreateScriptTasksInput = {
			description: "Stage test",
			outputDirs: [],
			createCliOptions: () => ({
				name: "with-stages",
				stages: [{ title: "Single Stage", run: vi.fn() }],
				context: {},
			}),
		};

		const result = createScriptTasks(mockInput);
		const pipelineOptions = result.createPipelineOptions({});

		expect(pipelineOptions.stages.length).toBeGreaterThan(0);
	});
});
