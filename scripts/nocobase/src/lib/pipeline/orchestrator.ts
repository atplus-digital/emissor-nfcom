import { createRootListrOptions } from "@generators/lib/cli/listr-config";
import { runStandardPipeline } from "@generators/lib/lifecycle/lifecycle";
import type { ListrTask } from "listr2";
import { Listr } from "listr2";
import type { GeneratorDefinition } from "../types";

type OrchestratorOptions = {
	concurrent?: boolean;
};

/**
 * Creates an orchestration task list from {@link GeneratorDefinition}s and
 * executes them via Listr2.
 *
 * Each generator runs its own pipeline stages; one failing does not
 * prevent others from running.
 *
 * @param generators — array of generator definitions to orchestrate
 */
export async function runOrchestrator(
	generators: GeneratorDefinition[],
	options: OrchestratorOptions = {},
): Promise<void> {
	const tasks = createOrchestrationTasks(generators);

	const rootListr = new Listr(
		tasks,
		createRootListrOptions({
			concurrent: options.concurrent,
			logLevel: "info",
		}),
	);
	await rootListr.run();
}

type GeneratorCliTask = ListrTask;

function createOrchestrationTasks(
	generators: GeneratorDefinition[],
): GeneratorCliTask[] {
	return generators.map((generator) => ({
		title: generator.name,
		task: (_, task) => {
			const pipelineInput = generator.createPipelineOptions(
				generator.defaultConfig,
			);

			return runStandardPipeline({
				...pipelineInput,
				task,
			});
		},
		exitOnError: false,
	}));
}
