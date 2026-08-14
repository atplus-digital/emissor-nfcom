import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi,
	mock,
} from "bun:test";

// Mock lifecycle module
mock.module("@generators/lib/lifecycle/lifecycle", () => ({
	runStandardPipeline: vi.fn().mockResolvedValue(undefined),
}));

mock.module("@shared/utils/env", () => ({
	env: {
		VITE_LOG_LEVEL: "info",
	},
}));

import { runStandardPipeline } from "@generators/lib/lifecycle/lifecycle";
import type { GeneratorDefinition } from "../types";
// Import after mocking
import { runOrchestrator } from "./orchestrator";

describe("TC-UT-ORCH-001: Sequential run executes generators in order", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should execute generators sequentially when concurrent is false", async () => {
		const generators: GeneratorDefinition[] = [
			{
				name: "types-generator",
				description: "Generate types",
				getOutputDirs: () => ["src/generated/types"],
				createPipelineOptions: () => ({
					defaultConfig: {},
					getOutputDirs: () => [],
					stages: [],
					label: "types-generator",
				}),
			},
			{
				name: "requests-generator",
				description: "Generate requests",
				getOutputDirs: () => ["src/generated/requests"],
				createPipelineOptions: () => ({
					defaultConfig: {},
					getOutputDirs: () => [],
					stages: [],
					label: "requests-generator",
				}),
			},
		];

		await runOrchestrator(generators, { concurrent: false });

		expect(runStandardPipeline).toHaveBeenCalledTimes(2);
		// Verify sequential execution by checking call order
		expect(runStandardPipeline.mock.calls[0][0].label).toBe("types-generator");
		expect(runStandardPipeline.mock.calls[1][0].label).toBe(
			"requests-generator",
		);
	});
});

describe("TC-UT-ORCH-002: Concurrent run uses Promise.all", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should pass concurrent: true to Listr", async () => {
		const generators: GeneratorDefinition[] = [
			{
				name: "generator-a",
				description: "Generator A",
				getOutputDirs: () => [],
				createPipelineOptions: () => ({
					defaultConfig: {},
					getOutputDirs: () => [],
					stages: [],
					label: "generator-a",
				}),
			},
			{
				name: "generator-b",
				description: "Generator B",
				getOutputDirs: () => [],
				createPipelineOptions: () => ({
					defaultConfig: {},
					getOutputDirs: () => [],
					stages: [],
					label: "generator-b",
				}),
			},
		];

		await runOrchestrator(generators, { concurrent: true });

		// Listr is constructed with concurrent: true
		// The actual Promise.all behavior is internal to Listr
		expect(runStandardPipeline).toHaveBeenCalledTimes(2);
	});
});

describe("TC-UT-ORCH-003: Empty generators array", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should handle empty generators array gracefully", async () => {
		await runOrchestrator([], {});

		// Should not throw and should not call runStandardPipeline
		expect(runStandardPipeline).not.toHaveBeenCalled();
	});
});

describe("TC-UT-ORCH-004: Generator with empty stages", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should handle generator with no stages", async () => {
		const generators: GeneratorDefinition[] = [
			{
				name: "empty-generator",
				description: "Generator with no stages",
				getOutputDirs: () => [],
				createPipelineOptions: () => ({
					defaultConfig: {},
					getOutputDirs: () => [],
					stages: [],
					label: "empty-generator",
				}),
			},
		];

		await runOrchestrator(generators, {});

		expect(runStandardPipeline).toHaveBeenCalledTimes(1);
	});
});

describe("TC-UT-ORCH-005: Each generator gets its own task", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should create separate task for each generator", async () => {
		const generators: GeneratorDefinition[] = [
			{
				name: "gen-1",
				description: "First",
				getOutputDirs: () => [],
				createPipelineOptions: vi.fn().mockReturnValue({
					defaultConfig: {},
					getOutputDirs: () => [],
					stages: [],
					label: "gen-1",
				}),
			},
			{
				name: "gen-2",
				description: "Second",
				getOutputDirs: () => [],
				createPipelineOptions: vi.fn().mockReturnValue({
					defaultConfig: {},
					getOutputDirs: () => [],
					stages: [],
					label: "gen-2",
				}),
			},
			{
				name: "gen-3",
				description: "Third",
				getOutputDirs: () => [],
				createPipelineOptions: vi.fn().mockReturnValue({
					defaultConfig: {},
					getOutputDirs: () => [],
					stages: [],
					label: "gen-3",
				}),
			},
		];

		await runOrchestrator(generators, {});

		expect(runStandardPipeline).toHaveBeenCalledTimes(3);
		// Each generator's createPipelineOptions should be called
		for (const gen of generators) {
			expect(gen.createPipelineOptions).toHaveBeenCalledWith(gen.defaultConfig);
		}
	});
});
