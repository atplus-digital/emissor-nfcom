import type { PipelineReportsContext } from "@generators/lib/pipeline/reports";

export interface PipelineExecutionContext<
	TRuntimeConfig,
	TPipelineContext = unknown,
> {
	tempDir: string;
	outputDirs: string[];
	runtimeConfig: TRuntimeConfig;
	overrideConfig?: Partial<TRuntimeConfig>;
	reports: PipelineReportsContext;
	pipelineContext?: TPipelineContext;
	finalResult?: unknown;
}
