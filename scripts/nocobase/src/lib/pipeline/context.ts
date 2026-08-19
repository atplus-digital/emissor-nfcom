export interface PipelineExecutionContext<
	TRuntimeConfig,
	TPipelineContext = unknown,
> {
	tempDir: string;
	outputDirs: string[];
	runtimeConfig: TRuntimeConfig;
	overrideConfig?: Partial<TRuntimeConfig>;
	pipelineContext?: TPipelineContext;
	finalResult?: unknown;
}
