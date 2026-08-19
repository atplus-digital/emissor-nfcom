import path from "node:path";
import type { OrchestrationTaskRunner } from "@shared/types";
import { beforeEach, describe, expect, it, vi, mock } from "bun:test";

const runStandardPipelineMock = vi.fn().mockResolvedValue(undefined);
const runPipelineStagesMock = vi.fn();
const writeFilesStageMock = vi.fn(async (ctx: unknown) => ctx);

mock.module("@shared/utils/env", () => ({
	resolveNocoBaseEnv: vi.fn(() => ({
		baseUrl: "https://example.com/api",
		token: "test-token",
		timeoutMs: 30_000,
	})),
}));

mock.module("@generators/lib/lifecycle/lifecycle", () => ({
	runStandardPipeline: runStandardPipelineMock,
}));

mock.module("@generators/lib/pipeline/runner", () => ({
	runPipelineStages: runPipelineStagesMock,
}));

mock.module("@generators/pipelines/generate-types/stages/write-files", () => ({
	writeFilesStage: writeFilesStageMock,
}));

mock.module("../../../../config/datasources", () => ({
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

mock.module("@shared/http/nocobase-client", () => ({
	NocoBaseApiClient: class MockNocoBaseApiClient {
		public baseUrl = "https://example.com/api";
		public async fetchCollections() {
			return [{ name: "users", fields: [] }];
		}
	},
}));

function createOrchestrationTask(): OrchestrationTaskRunner {
	const newListr = vi
		.fn()
		.mockReturnValue({ run: vi.fn().mockResolvedValue(undefined) });
	return { newListr } as unknown as OrchestrationTaskRunner;
}

describe("createGenerateTypesPipeline", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns pipeline definition with stages", async () => {
		const { createGenerateTypesPipeline } = await import(
			"@generators/pipelines/generate-types/pipeline"
		);

		const definition = createGenerateTypesPipeline();

		expect(definition.name).toBe("generate-types");
		expect(definition.stages).toHaveLength(1);
		expect(definition.context).toEqual({});
	});

	it("wires runStandardPipeline when stage run is invoked", async () => {
		const { createGenerateTypesPipeline } = await import(
			"@generators/pipelines/generate-types/pipeline"
		);

		const definition = createGenerateTypesPipeline();
		const task = createOrchestrationTask();

		await definition.stages[0].run({}, task);

		expect(runStandardPipelineMock).toHaveBeenCalledOnce();
		expect(runStandardPipelineMock.mock.calls[0][0].getOutputDirs()).toEqual([
			"packages/generated/types/nocobase/",
		]);
	});

	it("throws when Listr task wrapper is not provided", async () => {
		const { createGenerateTypesPipeline } = await import(
			"@generators/pipelines/generate-types/pipeline"
		);

		const definition = createGenerateTypesPipeline();

		expect(() => definition.stages[0].run({}, undefined)).toThrow(
			"task wrapper não fornecido",
		);
	});

	it("executes datasource sub-pipeline via runPipelineStages", async () => {
		runStandardPipelineMock.mockImplementationOnce(async (options) => {
			const dataSourceTask = createOrchestrationTask();
			const lifecycleTask = {
				newListr: vi.fn(
					(tasks: Array<{ task: (ctx: unknown, t: unknown) => unknown }>) => ({
						run: async () => {
							for (const item of tasks) {
								await item.task({}, dataSourceTask);
							}
						},
					}),
				),
			};
			const context = {
				tempDir: "/tmp/pipeline-test",
				outputDirs: [],
				runtimeConfig: {},
			};
			for (const stage of options.stages) {
				const listrResult = await stage(context, lifecycleTask);
				if (
					listrResult &&
					typeof (listrResult as { run?: unknown }).run === "function"
				) {
					await (listrResult as { run: () => Promise<void> }).run();
				}
			}
		});

		const { createGenerateTypesPipeline } = await import(
			"@generators/pipelines/generate-types/pipeline"
		);

		const orchestrationTask = createOrchestrationTask();
		const listrResult = await createGenerateTypesPipeline().stages[0].run(
			{},
			orchestrationTask,
		);
		if (
			listrResult &&
			typeof (listrResult as { run?: unknown }).run === "function"
		) {
			await (listrResult as { run: () => Promise<void> }).run();
		}

		expect(runPipelineStagesMock).toHaveBeenCalled();
		const stageNames = runPipelineStagesMock.mock.calls[0][1].map(
			(fn: { name?: string }) => fn.name,
		);
		expect(stageNames).toContain("fetchSchemas");
		expect(stageNames).toContain("buildTypes");
		expect(stageNames).toContain("generateContentStage");
		expect(stageNames).toContain("writeFilesToTempStage");
		expect(runPipelineStagesMock.mock.calls[0][1]).toHaveLength(4);
		expect(
			runPipelineStagesMock.mock.calls[0][0].pipelineContext.client.baseUrl,
		).toBe("https://example.com/api");
	});

	it("writeFilesToTempStage patches outputDir under tempDir", async () => {
		writeFilesStageMock.mockClear();
		runStandardPipelineMock.mockImplementationOnce(async (options) => {
			const dataSourceTask = createOrchestrationTask();
			const lifecycleTask = {
				newListr: vi.fn(
					(
						tasks: Array<{
							task: (
								ctx: unknown,
								t: OrchestrationTaskRunner,
							) => Promise<unknown>;
						}>,
					) => ({
						run: async () => {
							for (const item of tasks) {
								await item.task({}, dataSourceTask);
							}
						},
					}),
				),
			};
			const context = {
				tempDir: "/tmp/types-pipeline",
				outputDirs: [],
				runtimeConfig: {},
			};
			for (const stage of options.stages) {
				const listrResult = await stage(context, lifecycleTask);
				if (
					listrResult &&
					typeof (listrResult as { run?: unknown }).run === "function"
				) {
					await (listrResult as { run: () => Promise<void> }).run();
				}
			}
		});

		const { createGenerateTypesPipeline } = await import(
			"@generators/pipelines/generate-types/pipeline"
		);

		const listrResult = await createGenerateTypesPipeline().stages[0].run(
			{},
			createOrchestrationTask(),
		);
		if (
			listrResult &&
			typeof (listrResult as { run?: unknown }).run === "function"
		) {
			await (listrResult as { run: () => Promise<void> }).run();
		}

		expect(runPipelineStagesMock).toHaveBeenCalled();
		const stages = runPipelineStagesMock.mock.calls[0][1] as Array<
			(ctx: unknown, task: unknown) => Promise<unknown> & { name?: string }
		>;
		const writeFilesToTempStage = stages.find(
			(stage) => stage.name === "writeFilesToTempStage",
		);
		expect(writeFilesToTempStage).toBeDefined();
		if (!writeFilesToTempStage) {
			throw new Error("writeFilesToTempStage stage not found");
		}
		await writeFilesToTempStage(
			{
				tempDir: "/tmp/types-pipeline",
				runtimeConfig: { outputDir: "packages/generated/types/nocobase/" },
			},
			createOrchestrationTask(),
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
