import type { PipelineJsonReportResult } from "@generators/lib/lifecycle/lifecycle-tasks";
import type { PipelineExecutionContext } from "@generators/lib/pipeline/context";
import type { AsyncPipelineStage } from "@generators/lib/pipeline/runner";
import type { OrchestrationTaskRunner, TaskRunner } from "@shared/types";
import type { ListrTaskResult } from "listr2";

// ──────────────────────────────────────────────
// Generator definitions
// ──────────────────────────────────────────────

export interface GeneratorDefinition<TRuntimeConfig = unknown> {
	name: string;
	description: string;
	createPipelineOptions: (
		config: TRuntimeConfig,
	) => StandardPipelineFactoryInput<TRuntimeConfig>;
	defaultConfig?: TRuntimeConfig;
	getOutputDirs: (config: TRuntimeConfig) => string[];
}

interface StandardPipelineInput<
	TRuntimeConfig = unknown,
	TPipelineContext = unknown,
> {
	task: TaskRunner;
	overrideConfig?: Partial<TRuntimeConfig>;
	defaultConfig: TRuntimeConfig;
	getOutputDirs: (config: TRuntimeConfig) => string[];
	stages: AsyncPipelineStage<
		PipelineExecutionContext<TRuntimeConfig, TPipelineContext>
	>[];
	label?: string;
	reportsOutputPath?: string;
	onReportReady?: (result: PipelineJsonReportResult) => void;
}

type StandardPipelineFactoryInput<
	TRuntimeConfig = unknown,
	TPipelineContext = unknown,
> = Omit<StandardPipelineInput<TRuntimeConfig, TPipelineContext>, "task">;

// ──────────────────────────────────────────────
// Orchestration
// ──────────────────────────────────────────────

type NestedTaskList = ReturnType<OrchestrationTaskRunner["newListr"]>;

export type OrchestrationTaskResult = NestedTaskList | ListrTaskResult<unknown>;
