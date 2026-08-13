import type { TaskRunner } from "@shared/types";
import type { ListrTaskResult } from "listr2";

type PipelineStageResult<TContext> =
	| Promise<TContext>
	| ReturnType<TaskRunner["newListr"]>;

export type AsyncPipelineStage<TContext> = (
	context: TContext,
	task: TaskRunner,
) => PipelineStageResult<TContext>;

/**
 * Converts a camelCase or kebab-case function name to a human-readable title.
 * e.g. "fetchSchemas" → "Fetch schemas", "load-schemas" → "Load schemas"
 */
function toHumanTitle(name: string): string {
	// Handle camelCase: insert space before uppercase letters
	const spaced = name.replace(/([a-z])([A-Z])/g, "$1 $2");
	// Handle kebab-case: replace hyphens with spaces
	const dashed = spaced.replace(/-/g, " ");
	// Capitalize first letter
	return dashed.charAt(0).toUpperCase() + dashed.slice(1);
}

function getStageTitle<TContext>(
	stage: AsyncPipelineStage<TContext>,
	index: number,
): string {
	const name = stage.name?.trim();
	if (name && name.length > 0) {
		return toHumanTitle(name);
	}

	return `Estágio ${index + 1}`;
}

export function runPipelineStages<TContext>(
	initialContext: TContext,
	stages: AsyncPipelineStage<TContext>[],
	task: TaskRunner,
): ListrTaskResult<unknown> | undefined {
	let currentContext = initialContext;

	if (stages.length === 1) {
		const [stage] = stages;
		if (!stage) return;
		const result = stage(currentContext, task);
		if (result === undefined) return;

		if (
			typeof result === "object" &&
			result !== null &&
			"run" in result &&
			typeof result.run === "function"
		) {
			return result;
		}

		return Promise.resolve(result).then((nextContext) => {
			if (nextContext !== undefined) {
				currentContext = nextContext as TContext;
			}
		});
	}

	const subTasks = stages.map((stage, index) => ({
		title: getStageTitle(stage, index),
		task: async (
			_ctx: unknown,
			stageTask: TaskRunner,
		): Promise<ListrTaskResult<unknown>> => {
			const result = stage(currentContext, stageTask);
			if (result === undefined) return;

			if (
				typeof result === "object" &&
				result !== null &&
				"run" in result &&
				typeof result.run === "function"
			) {
				return result;
			}

			const nextContext = await result;
			if (nextContext !== undefined) {
				currentContext = nextContext as TContext;
			}
		},
	}));

	return task.newListr(subTasks, {
		concurrent: false,
		exitOnError: true,
	});
}
