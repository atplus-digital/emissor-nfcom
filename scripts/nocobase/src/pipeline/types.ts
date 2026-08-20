import type { PipelineExecutionContext } from "./context";
import type { AsyncPipelineStage } from "./runner";

/**
 * A generator pipeline registered with the CLI: identity (name/flag),
 * generated output dirs, and the stage tree built for each run.
 */
export interface GeneratorPipeline {
	/** Pipeline name (Listr2 task title in the CLI). */
	name: string;
	/** Pipeline description (used in docs/README). */
	description: string;
	/** CLI flag that selects this pipeline (e.g. `--types`). */
	flag: string;
	/** Runs by default when no generator flag is passed. */
	runInDefault: boolean;
	/** Generated output dirs (workspace lock, diff, swap). */
	outputDirs: string[];
	/** Builds the pipeline's stage tree for a single run. */
	buildStages: () => AsyncPipelineStage<PipelineExecutionContext>[];
}
