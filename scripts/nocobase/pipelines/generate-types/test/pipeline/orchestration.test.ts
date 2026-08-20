import { beforeEach, describe, expect, it, mock, vi } from "bun:test";
import path from "node:path";
import type { PipelineExecutionContext } from "@generators/pipeline/context";
import type { TaskRunner } from "@generators/types";

const writeFilesStageMock = vi.fn(async (ctx: unknown) => ctx);

mock.module("@generators/utils/env", () => ({
	resolveNocoBaseEnv: vi.fn(() => ({
		baseUrl: "https://nocobase.test/api",
		token: "token",
		timeoutMs: 5_000,
	})),
}));

mock.module("@pipelines/generate-types/stages/write-files", () => ({
	writeFilesStage: writeFilesStageMock,
}));

mock.module("@pipelines/generate-types/stages/fetch-schemas", () => ({
	fetchSchemas: vi.fn(async (ctx: unknown) => ctx),
}));

mock.module("@pipelines/generate-types/stages/build-types", () => ({
	buildTypes: vi.fn(async (ctx: unknown) => ctx),
}));

mock.module("@pipelines/generate-types/stages/generate-content", () => ({
	generateContentStage: vi.fn(async (ctx: unknown) => ctx),
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
		public baseUrl = "https://nocobase.test/api";
		public async fetchCollections(dataSourceKey: string) {
			return [{ name: "users", fields: [], dataSourceKey }];
		}
	},
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
						const nested = await item.task({}, nestedTask);
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

describe("generate-types pipeline orchestration", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("wires client baseUrl and patches write-files outputDir under tempDir", async () => {
		const { generateTypesPipeline } = await import(
			"@pipelines/generate-types/pipeline"
		);

		const [stage] = generateTypesPipeline.buildStages();
		expect(stage).toBeDefined();
		if (!stage) throw new Error("stage ausente");

		const context: PipelineExecutionContext = {
			tempDir: "/tmp/orchestration-types",
			outputDirs: ["packages/generated/types/nocobase/"],
		};
		const result = stage(context, makeTask());
		if (result && typeof (result as { run?: unknown }).run === "function") {
			await (result as { run: () => Promise<void> }).run();
		}

		expect(writeFilesStageMock).toHaveBeenCalled();
		const patched = writeFilesStageMock.mock.calls[0][0] as {
			runtimeConfig: { outputDir: string };
			pipelineContext: { client: { baseUrl: string } };
		};

		expect(patched.pipelineContext.client.baseUrl).toBe(
			"https://nocobase.test/api",
		);
		expect(patched.runtimeConfig.outputDir).toBe(
			path.join(
				"/tmp/orchestration-types",
				"packages/generated/types/nocobase/",
			),
		);
	});
});
