import path from "node:path";
import type { OrchestrationTaskRunner } from "@shared/types";
import { beforeEach, describe, expect, it, vi, mock } from "bun:test";

const writeFilesStageMock = vi.fn(async (ctx: unknown) => ctx);

mock.module("@shared/utils/env", () => ({
	resolveNocoBaseEnv: vi.fn(() => ({
		baseUrl: "https://nocobase.test/api",
		token: "token",
		timeoutMs: 5_000,
	})),
}));

mock.module("@generators/lib/lifecycle/lifecycle", () => ({
	runStandardPipeline: vi.fn(async (options) => {
		const makeListrRunner = (): OrchestrationTaskRunner => ({
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
						const runner = makeListrRunner();
						for (const item of tasks) {
							const nested = await item.task({}, runner);
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
		});
		const lifecycleTask = makeListrRunner();
		const context = {
			tempDir: "/tmp/orchestration-types",
			outputDirs: [],
			runtimeConfig: {},
			reports: { schemaVersion: 1 as const, namespaces: {} },
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
	}),
}));

mock.module("@generators/pipelines/generate-types/stages/write-files", () => ({
	writeFilesStage: writeFilesStageMock,
}));

mock.module(
	"@generators/pipelines/generate-types/stages/fetch-schemas",
	() => ({
		fetchSchemas: vi.fn(async (ctx: unknown) => ctx),
	}),
);

mock.module("@generators/pipelines/generate-types/stages/build-types", () => ({
	buildTypes: vi.fn(async (ctx: unknown) => ctx),
}));

mock.module(
	"@generators/pipelines/generate-types/stages/generate-content",
	() => ({
		generateContentStage: vi.fn(async (ctx: unknown) => ctx),
	}),
);

mock.module(
	"@generators/pipelines/generate-types/stages/write-reports",
	() => ({
		writeReportsStage: vi.fn(async (ctx: unknown) => ctx),
	}),
);

mock.module("../../../../config/datasources", () => ({
	dataSourceConfigs: [
		{
			name: "mock-nocobase",
			dataSource: "main",
			outputDir: "src/generated/types/nocobase/",
			collections: ["users"],
			splitCollections: [],
		},
	],
}));

mock.module("@shared/http/nocobase-client", () => ({
	NocoBaseApiClient: class MockNocoBaseApiClient {
		public baseUrl = "https://nocobase.test/api";
		public async fetchCollections(dataSourceKey: string) {
			return [{ name: "users", fields: [], dataSourceKey }];
		}
	},
}));

function createOrchestrationTask(): OrchestrationTaskRunner {
	return {
		newListr: vi.fn(
			(
				tasks: Array<{
					task: (
						ctx: unknown,
						t: OrchestrationTaskRunner,
					) => Promise<unknown> | unknown;
				}>,
			) => ({
				run: async () => {
					const nestedTask = createOrchestrationTask();
					for (const item of tasks) {
						await item.task({}, nestedTask);
					}
				},
			}),
		),
	} as unknown as OrchestrationTaskRunner;
}

describe("generate-types pipeline orchestration", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("wires client baseUrl and patches write-files outputDir under tempDir", async () => {
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

		expect(writeFilesStageMock).toHaveBeenCalled();
		const patched = writeFilesStageMock.mock.calls[0][0] as {
			runtimeConfig: { outputDir: string };
			pipelineContext: { client: { baseUrl: string } };
		};

		expect(patched.pipelineContext.client.baseUrl).toBe(
			"https://nocobase.test/api",
		);
		expect(patched.runtimeConfig.outputDir).toBe(
			path.join("/tmp/orchestration-types", "src/generated/types/nocobase/"),
		);
	});
});
