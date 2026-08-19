import type { OrchestrationTaskRunner } from "@shared/types";
import { beforeEach, describe, expect, it, vi, mock } from "bun:test";

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
const runStandardPipelineMock = vi.fn(async (options) => {
	const lifecycleTask = {
		newListr: vi.fn((tasks: Array<{ task: (ctx: unknown, t: unknown) => unknown }>) => ({
			run: async () => {
				const nested = createOrchestrationTask();
				for (const item of tasks) { await item.task({}, nested); }
			},
		})),
	} as unknown as OrchestrationTaskRunner;
	const context = {
		tempDir: "/tmp/client-types",
		outputDirs: [],
		runtimeConfig: {},
		reports: { schemaVersion: 1 as const, namespaces: {} },
	};
	for (const stage of options.stages) {
		const res = await stage(context, lifecycleTask);
		if (res && typeof (res as { run?: unknown }).run === "function") {
			await (res as { run: () => Promise<void> }).run();
		}
	}
});

mock.module("@shared/utils/env", () => ({
	resolveNocoBaseEnv: vi.fn(() => ({ baseUrl: "https://client.test/api", token: "token", timeoutMs: 5000 })),
}));

mock.module("@shared/http/nocobase-client", () => ({
	NocoBaseApiClient: class MockNocoBaseApiClient {
		public baseUrl = "";
		public async fetchCollections() {
			return [{ name: "users", fields: [{ name: "id", type: "integer" }] }];
		}
	},
}));

mock.module("../../../../config/datasources", () => ({
	dataSourceConfigs: [{
		name: "mock-nocobase", type: "nocobase", dataSource: "main",
		outputDir: "src/generated/types/nocobase/", collections: ["users"],
		splitCollections: [], inferRelationsByName: false,
	}],
}));

mock.module("@generators/lib/pipeline/runner", () => ({
	runPipelineStages: runPipelineStagesMock,
}));

mock.module("@generators/lib/lifecycle/lifecycle", () => ({
	runStandardPipeline: runStandardPipelineMock,
}));

mock.module("@generators/pipelines/generate-types/stages/write-files", () => ({
	writeFilesStage: writeFilesStageMock,
}));

function createOrchestrationTask(): OrchestrationTaskRunner {
	return {
		newListr: vi.fn((tasks: Array<{ task: (ctx: unknown, t: OrchestrationTaskRunner) => Promise<unknown> | unknown }>) => ({
			run: async () => {
				const nested = createOrchestrationTask();
				for (const item of tasks) { await item.task({}, nested); }
			},
		})),
	} as unknown as OrchestrationTaskRunner;
}

describe("generate-types pipeline client wiring", () => {
	beforeEach(() => { vi.clearAllMocks(); });

	it("calls client.fetchCollections via the real fetch-schemas stage", async () => {
		const { createGenerateTypesPipeline } = await import("@generators/pipelines/generate-types/pipeline");

		const listrResult = await createGenerateTypesPipeline().stages[0].run({}, createOrchestrationTask());
		if (listrResult && typeof (listrResult as { run?: unknown }).run === "function") {
			await (listrResult as { run: () => Promise<void> }).run();
		}

		expect(runStandardPipelineMock).toHaveBeenCalled();
		expect(runPipelineStagesMock).toHaveBeenCalled();
		expect(writeFilesStageMock).toHaveBeenCalled();
	});
});
