import type { PipelineExecutionContext } from "@generators/lib/pipeline/context";
import type { PipelineReportsContext } from "@generators/lib/pipeline/reports";
import type { DataSourceGenerationConfig } from "@generators/pipelines/generate-types/@types/script";
import type { GenerateTypesPipelineCtx } from "@generators/pipelines/generate-types/stages/fetch-schemas";
import type { TaskRunner } from "@shared/types";
import { vi } from "vitest";

export function createMockTask(): TaskRunner {
	return { output: "" } as TaskRunner;
}

function createMockReports(): PipelineReportsContext {
	return {
		schemaVersion: 1,
		namespaces: {},
	};
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
		tempDir: "/tmp/vitest-generate-types",
		outputDirs: [runtimeConfig.outputDir ?? "/tmp/out"],
		runtimeConfig,
		reports: createMockReports(),
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
