import { beforeEach, describe, expect, it, mock, vi } from "bun:test";
import type { PipelineExecutionContext } from "@generators/pipeline/context";
import type { TaskRunner } from "@generators/types";

const writeFilesStageMock = vi.fn(async (ctx: unknown) => ctx);
const runPipelineStagesMock = vi.fn(async (context, stages, task) => {
	let ctx = context;
	for (const stage of stages) {
		const result = await stage(ctx, task);
		if (result && typeof (result as { run?: unknown }).run === "function") {
			await (result as { run: () => Promise<void> }).run();
		} else if (result && typeof result === "object") {
			// Estágios retornam um novo contexto — encadeia para o próximo.
			ctx = result;
		}
	}
});

mock.module("@generators/utils/env", () => ({
	resolveNocoBaseEnv: vi.fn(() => ({
		baseUrl: "https://client.test/api",
		token: "token",
		timeoutMs: 5000,
	})),
}));

mock.module("@generators/http/nocobase-client", () => ({
	NocoBaseApiClient: class MockNocoBaseApiClient {
		public baseUrl = "";
		public async fetchCollections() {
			return [{ name: "users", fields: [{ name: "id", type: "integer" }] }];
		}
	},
}));

mock.module("../../../config/datasources", () => ({
	dataSourceConfigs: [
		{
			name: "mock-nocobase",
			dataSource: "main",
			outputDir: "packages/generated/types/nocobase/",
			collections: ["users"],
			splitCollections: [],
			inferRelationsByName: false,
		},
	],
}));

mock.module("@generators/pipeline/runner", () => ({
	runPipelineStages: runPipelineStagesMock,
}));

mock.module("@pipelines/generate-types/stages/write-files", () => ({
	writeFilesStage: writeFilesStageMock,
}));

function makeTask(): TaskRunner {
	return {
		newListr: vi.fn(
			(
				tasks: Array<{
					task: (ctx: unknown, t: TaskRunner) => Promise<unknown> | unknown;
				}>,
			) => ({
				run: async () => {
					const nestedTask = makeTask();
					for (const item of tasks) {
						await item.task({}, nestedTask);
					}
				},
			}),
		),
	} as unknown as TaskRunner;
}

describe("generate-types pipeline client wiring", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("calls client.fetchCollections via the real fetch-schemas stage", async () => {
		const { generateTypesPipeline } = await import(
			"@pipelines/generate-types/pipeline"
		);

		const [stage] = generateTypesPipeline.buildStages();
		expect(stage).toBeDefined();
		if (!stage) throw new Error("stage ausente");

		const context: PipelineExecutionContext = {
			tempDir: "/tmp/client-types",
			outputDirs: ["packages/generated/types/nocobase/"],
		};
		const result = stage(context, makeTask());
		if (result && typeof (result as { run?: unknown }).run === "function") {
			await (result as { run: () => Promise<void> }).run();
		}

		expect(runPipelineStagesMock).toHaveBeenCalled();
		expect(writeFilesStageMock).toHaveBeenCalled();
	});
});
