import * as fs from "node:fs";
import * as path from "node:path";
import { applyWorkspaceLockIfNeeded } from "@generators/lib/io/locker";
import { createReportsContext } from "@generators/lib/pipeline/reports";
import { isValidationSkipped } from "@generators/lib/validation/validation-options";
import type { TaskRunner } from "@shared/types";
import type { PipelineExecutionContext } from "../pipeline/context";
import { type AsyncPipelineStage, runPipelineStages } from "../pipeline/runner";
import type {
	LifecycleCtx,
	LifecycleTaskParams,
	PipelineJsonReportResult,
} from "./lifecycle-tasks";
import {
	backupCurrentOutput,
	diffTempVsOutput,
	handleNoChanges,
	renderReportsSummary,
	swapTempToOutputDirs,
	validateGeneratedOutput,
} from "./lifecycle-tasks";

interface StandardPipelineOptions<TRuntimeConfig, TPipelineContext> {
	task: TaskRunner;
	overrideConfig?: Partial<TRuntimeConfig>;
	defaultConfig: TRuntimeConfig;
	getOutputDirs: (config: TRuntimeConfig) => string[];
	pipelineContext?: TPipelineContext;
	stages: AsyncPipelineStage<
		PipelineExecutionContext<TRuntimeConfig, TPipelineContext>
	>[];
	label?: string;
	reportsOutputPath?: string;
	onReportReady?: (result: PipelineJsonReportResult) => void;
}

export function runStandardPipeline<TRuntimeConfig, TPipelineContext>(
	options: StandardPipelineOptions<TRuntimeConfig, TPipelineContext>,
): ReturnType<TaskRunner["newListr"]> {
	const label = options.label ?? "pipeline";
	const cwd = process.cwd();
	const timestamp = Date.now();
	const randomId = Math.random().toString(36).slice(2, 8);
	const tempDir = path.join(cwd, ".temp", `${timestamp}-${randomId}`);

	const runtimeConfig: TRuntimeConfig = options.overrideConfig
		? { ...options.defaultConfig, ...options.overrideConfig }
		: options.defaultConfig;

	const outputDirs = options.getOutputDirs(runtimeConfig);

	const context: PipelineExecutionContext<TRuntimeConfig, TPipelineContext> = {
		tempDir,
		outputDirs,
		runtimeConfig,
		overrideConfig: options.overrideConfig,
		reports: createReportsContext(),
		pipelineContext: options.pipelineContext,
	};

	const taskParams: LifecycleTaskParams<TRuntimeConfig, TPipelineContext> = {
		tempDir,
		outputDirs,
		context,
		label,
		reportsOutputPath: options.reportsOutputPath,
		task: options.task,
		cwd,
		timestamp,
		randomId,
		onReportReady: options.onReportReady,
	};

	if (outputDirs.length === 0) {
		return options.task.newListr(
			[
				{
					title: "Pipeline",
					task: (_ctx, subTask: TaskRunner) =>
						runPipelineStages(context, options.stages, subTask),
				},
			],
			{
				concurrent: false,
				exitOnError: true,
				ctx: { hasChanges: false } satisfies LifecycleCtx,
			},
		) as ReturnType<TaskRunner["newListr"]>;
	}

	// Ensure temp dir exists only for pipelines that emit staged output.
	fs.mkdirSync(tempDir, { recursive: true });

	return options.task.newListr(
		[
			// 0. Lock generated output folders in workspace editor settings
			{
				title: "Bloqueando workspace para saídas geradas",
				task: async (): Promise<void> => {
					applyWorkspaceLockIfNeeded(outputDirs, true);
				},
			},
			// 1. Run pipeline stages
			{
				title: "Pipeline",
				task: (_ctx, subTask: TaskRunner) =>
					runPipelineStages(context, options.stages, subTask),
			},
			// 2. Diff temp vs output
			{
				title: "Comparando alterações",
				task: async (ctx): Promise<void> =>
					diffTempVsOutput(ctx as LifecycleCtx, taskParams),
			},
			// 3. Validate generated output (only when changes exist)
			{
				title: "Validando saída gerada",
				skip: (ctx): string | boolean => {
					if (isValidationSkipped()) {
						return "Validação desabilitada (--skip-validate)";
					}
					if (!(ctx as LifecycleCtx).hasChanges) {
						return "Sem alterações";
					}
					return false;
				},
				task: async (ctx): Promise<void> =>
					validateGeneratedOutput(ctx as LifecycleCtx, taskParams),
			},
			// 4. No changes → cleanup and render reports
			{
				title: "Sem alterações",
				skip: (ctx): string | boolean =>
					(ctx as LifecycleCtx).hasChanges
						? "Sem alterações detectadas"
						: false,
				task: async (ctx): Promise<void> =>
					handleNoChanges(ctx as LifecycleCtx, taskParams),
			},
			// 4. Backup current output (only when changes exist)
			{
				title: "Realizando backup",
				skip: (ctx): string | boolean =>
					!(ctx as LifecycleCtx).hasChanges ? "Sem alterações" : false,
				task: async (): Promise<void> => backupCurrentOutput(taskParams),
			},
			// 5. Swap temp → output (only when changes exist)
			{
				title: "Aplicando alterações",
				skip: (ctx): string | boolean =>
					!(ctx as LifecycleCtx).hasChanges ? "Sem alterações" : false,
				task: async (): Promise<void> => swapTempToOutputDirs(taskParams),
			},
			// 6. Emit report JSON + summary (only when changes exist)
			{
				title: "Gerando relatórios",
				skip: (ctx): string | boolean =>
					!(ctx as LifecycleCtx).hasChanges ? "Sem alterações" : false,
				task: async (ctx): Promise<void> =>
					renderReportsSummary(ctx as LifecycleCtx, taskParams),
			},
		],
		{
			concurrent: false,
			exitOnError: true,
			ctx: { hasChanges: false } satisfies LifecycleCtx,
		},
	) as ReturnType<TaskRunner["newListr"]>;
}
