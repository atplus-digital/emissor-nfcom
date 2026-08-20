import * as fs from "node:fs";
import * as path from "node:path";
import { isValidationSkipped } from "@generators/cli/flags";
import { applyWorkspaceLockIfNeeded } from "@generators/io/locker";
import type { TaskRunner } from "@generators/types";
import type { PipelineExecutionContext } from "../pipeline/context";
import { type AsyncPipelineStage, runPipelineStages } from "../pipeline/runner";
import type { LifecycleCtx, LifecycleTaskParams } from "./lifecycle-tasks";
import {
	diffTempVsOutput,
	handleNoChanges,
	renderDiffSummary,
	swapTempToOutputDirs,
	validateGeneratedOutput,
} from "./lifecycle-tasks";

interface StandardPipelineOptions {
	task: TaskRunner;
	outputDirs: string[];
	pipelineContext?: unknown;
	stages: AsyncPipelineStage<PipelineExecutionContext>[];
}

export function runStandardPipeline(
	options: StandardPipelineOptions,
): ReturnType<TaskRunner["newListr"]> {
	const cwd = process.cwd();
	const timestamp = Date.now();
	const randomId = Math.random().toString(36).slice(2, 8);
	const tempDir = path.join(cwd, ".temp", `${timestamp}-${randomId}`);

	const outputDirs = options.outputDirs;

	const context: PipelineExecutionContext = {
		tempDir,
		outputDirs,
		pipelineContext: options.pipelineContext,
	};

	const taskParams: LifecycleTaskParams = {
		tempDir,
		outputDirs,
		task: options.task,
		cwd,
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
			// 4. No changes → cleanup and summarize
			{
				title: "Sem alterações",
				skip: (ctx): string | boolean =>
					(ctx as LifecycleCtx).hasChanges
						? "Sem alterações detectadas"
						: false,
				task: async (ctx): Promise<void> =>
					handleNoChanges(ctx as LifecycleCtx, taskParams),
			},
			// 5. Swap temp → output (only when changes exist)
			{
				title: "Aplicando alterações",
				skip: (ctx): string | boolean =>
					!(ctx as LifecycleCtx).hasChanges ? "Sem alterações" : false,
				task: async (): Promise<void> => swapTempToOutputDirs(taskParams),
			},
			// 6. Diff summary (only when changes exist)
			{
				title: "Resumo de alterações",
				skip: (ctx): string | boolean =>
					!(ctx as LifecycleCtx).hasChanges ? "Sem alterações" : false,
				task: async (ctx): Promise<void> =>
					renderDiffSummary(ctx as LifecycleCtx, taskParams),
			},
		],
		{
			concurrent: false,
			exitOnError: true,
			ctx: { hasChanges: false } satisfies LifecycleCtx,
		},
	) as ReturnType<TaskRunner["newListr"]>;
}
