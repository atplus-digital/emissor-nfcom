import type { PipelineExecutionContext } from "@generators/lib/pipeline/context";
import type { DataSourceGenerationConfig } from "@generators/pipelines/generate-types/@types/script";
import type { GenerateTypesPipelineCtx } from "@generators/pipelines/generate-types/stages/fetch-schemas";
import type { TaskRunner } from "@shared/types";
import { vi } from "bun:test";

export function createMockTask(): TaskRunner {
	return { output: "" } as TaskRunner;
}

export function createMockDataSourceConfig(
	overrides: Partial<DataSourceGenerationConfig> = {},
): DataSourceGenerationConfig {
	return {
		name: "test-ds",
		type: "nocobase",
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
): PipelineExecutionContext<
	DataSourceGenerationConfig,
	GenerateTypesPipelineCtx
> {
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
