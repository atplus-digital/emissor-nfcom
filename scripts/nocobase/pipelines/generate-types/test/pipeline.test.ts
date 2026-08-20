import { beforeEach, describe, expect, it, mock, vi } from "bun:test";
import path from "node:path";
import type { PipelineExecutionContext } from "@generators/pipeline/context";
import type { TaskRunner } from "@generators/types";

const runPipelineStagesMock = vi.fn();
const writeFilesStageMock = vi.fn(async (ctx: unknown) => ctx);

mock.module("@generators/utils/env", () => ({
	resolveNocoBaseEnv: vi.fn(() => ({
		baseUrl: "https://example.com/api",
		token: "test-token",
		timeoutMs: 30_000,
	})),
}));

mock.module("@generators/pipeline/runner", () => ({
	runPipelineStages: runPipelineStagesMock,
}));

mock.module("@pipelines/generate-types/stages/write-files", () => ({
	writeFilesStage: writeFilesStageMock,
}));

mock.module("../../../config/datasources", () => ({
	dataSourceConfigs: [
		{
			name: "mock-nocobase",
			dataSource: "main",
			outputDir: "packages/generated/types/nocobase/",
			collections: ["users"],
			splitCollections: [],
		},
	],
}));

mock.module("@generators/http/nocobase-client", () => ({
	NocoBaseApiClient: class MockNocoBaseApiClient {
		public baseUrl = "https://example.com/api";
		public async fetchCollections() {
			return [{ name: "users", fields: [] }];
		}
	},
}));

function makeTask(): TaskRunner {
	return {
		newListr: vi
			.fn()
			.mockReturnValue({ run: vi.fn().mockResolvedValue(undefined) }),
	} as unknown as TaskRunner;
}

/** Task do lifecycle: roda cada task do fan-out com a própria sub-task. */
function makeLifecycleTask(): TaskRunner {
	return {
		newListr: vi.fn(
			(tasks: Array<{ task: (ctx: unknown, t: TaskRunner) => unknown }>) => ({
				run: async () => {
					for (const item of tasks) {
						const nested = await item.task({}, makeTask());
						if (
							nested &&
							typeof (nested as { run?: unknown }).run === "function"
						) {
							await (nested as { run: () => Promise<void> }).run();
						}
					}
				},
			}),
		),
	} as unknown as TaskRunner;
}

function makeContext(): PipelineExecutionContext {
	return {
		tempDir: "/tmp/pipeline-test",
		outputDirs: ["packages/generated/types/nocobase/"],
	};
}

describe("generateTypesPipeline", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("expose pipeline metadata (name, flag, outputDirs, stages)", async () => {
		const { generateTypesPipeline } = await import(
			"@pipelines/generate-types/pipeline"
		);

		expect(generateTypesPipeline.name).toBe("generate-types");
		expect(generateTypesPipeline.flag).toBe("--types");
		expect(generateTypesPipeline.runInDefault).toBe(true);
		expect(generateTypesPipeline.outputDirs).toEqual([
			"packages/generated/types/nocobase/",
		]);
		expect(generateTypesPipeline.buildStages()).toHaveLength(1);
	});

	it("fans out datasources via runPipelineStages with 4 stages", async () => {
		const { generateTypesPipeline } = await import(
			"@pipelines/generate-types/pipeline"
		);

		const [stage] = generateTypesPipeline.buildStages();
		expect(stage).toBeDefined();
		if (!stage) throw new Error("stage ausente");

		const lifecycleTask = makeLifecycleTask();
		const result = stage(makeContext(), lifecycleTask);
		await (result as { run: () => Promise<void> }).run();

		expect(runPipelineStagesMock).toHaveBeenCalled();
		const stageNames = runPipelineStagesMock.mock.calls[0][1].map(
			(fn: { name?: string }) => fn.name,
		);
		expect(stageNames).toEqual([
			"fetchSchemas",
			"buildTypes",
			"generateContentStage",
			"writeFilesToTempStage",
		]);
		expect(
			runPipelineStagesMock.mock.calls[0][0].pipelineContext.client.baseUrl,
		).toBe("https://example.com/api");
	});

	it("writeFilesToTempStage patches outputDir under tempDir", async () => {
		const { generateTypesPipeline } = await import(
			"@pipelines/generate-types/pipeline"
		);

		const [stage] = generateTypesPipeline.buildStages();
		expect(stage).toBeDefined();
		if (!stage) throw new Error("stage ausente");

		const lifecycleTask = makeLifecycleTask();
		const result = stage(makeContext(), lifecycleTask);
		await (result as { run: () => Promise<void> }).run();

		expect(runPipelineStagesMock).toHaveBeenCalled();
		const stages = runPipelineStagesMock.mock.calls[0][1] as Array<
			(ctx: unknown, task: unknown) => Promise<unknown> & { name?: string }
		>;
		const writeFilesToTempStage = stages.find(
			(s) => s.name === "writeFilesToTempStage",
		);
		expect(writeFilesToTempStage).toBeDefined();
		if (!writeFilesToTempStage) {
			throw new Error("writeFilesToTempStage stage not found");
		}

		await writeFilesToTempStage(
			{
				tempDir: "/tmp/types-pipeline",
				outputDirs: [],
				runtimeConfig: { outputDir: "packages/generated/types/nocobase/" },
			},
			makeTask(),
		);

		expect(writeFilesStageMock).toHaveBeenCalledWith(
			expect.objectContaining({
				runtimeConfig: expect.objectContaining({
					outputDir: path.join(
						"/tmp/types-pipeline",
						"packages/generated/types/nocobase/",
					),
				}),
			}),
			expect.anything(),
		);
	});
});
