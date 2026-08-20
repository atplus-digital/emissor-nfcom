/**
 * Base context passed to every pipeline stage by the lifecycle runner.
 * Pipelines may intersect this type with their own extensions (e.g. a
 * per-datasource `runtimeConfig`) — the kernel never assumes more.
 */
export interface PipelineExecutionContext {
	/** Temp output dir for this run (`.temp/<timestamp>-<id>`). */
	tempDir: string;
	/** Generated output dirs (workspace lock, diff, swap). */
	outputDirs: string[];
	/** Pipeline-defined extras (e.g. API client, datasource config). */
	pipelineContext?: unknown;
}
