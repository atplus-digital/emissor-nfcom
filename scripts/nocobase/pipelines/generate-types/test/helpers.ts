import { vi } from "bun:test";
import type { TaskRunner } from "@generators/types";
import type { DataSourceGenerationConfig } from "@pipelines/generate-types/@types/script";
import type {
	GenerateTypesPipelineCtx,
	GenerateTypesStageCtx,
} from "@pipelines/generate-types/stages/fetch-schemas";

export function createMockTask(): TaskRunner {
	return { output: "" } as TaskRunner;
}

export function createMockDataSourceConfig(
	overrides: Partial<DataSourceGenerationConfig> = {},
): DataSourceGenerationConfig {
	return {
		name: "test-ds",
		dataSource: "main",
		outputDir: "/tmp/out",
		splitCollections: [],
		...overrides,
	};
}

export function createPipelineContext(
	overrides: {
		runtimeConfig?: Partial<DataSourceGenerationConfig>;
		pipelineContext?: Partial<GenerateTypesPipelineCtx>;
	} = {},
): GenerateTypesStageCtx {
	const runtimeConfig = createMockDataSourceConfig(overrides.runtimeConfig);
	return {
		tempDir: "/tmp/nocobase-generate-types",
		outputDirs: [runtimeConfig.outputDir ?? "/tmp/out"],
		runtimeConfig,
		pipelineContext: {
			dataSource: runtimeConfig,
			...(overrides.pipelineContext === undefined
				? {
						client: {
							baseUrl: "http://localhost",
							fetchCollections: vi.fn(),
						},
					}
				: overrides.pipelineContext),
		} as GenerateTypesPipelineCtx,
	};
}
