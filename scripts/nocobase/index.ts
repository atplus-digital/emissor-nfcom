import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { writeCliError } from "@generators/cli/cli-output";
import { setDiffDebug, setValidationSkipped } from "@generators/cli/flags";
import { formatErrorMessage } from "@generators/cli/format-error";
import { createRootListrOptions } from "@generators/cli/listr-config";
import { runStandardPipeline } from "@generators/lifecycle/lifecycle";
import type { TaskRunner } from "@generators/types";
import { parseCliArgs, resolveCliArgv } from "@generators/utils/args";
import { env } from "@generators/utils/env";
import { Listr } from "listr2";
import { PIPELINES } from "./pipelines";

async function main(): Promise<void> {
	const args = resolveCliArgv(process.argv);
	const { flags, errors } = parseCliArgs(args);

	for (const error of errors) {
		writeCliError(error);
	}
	if (errors.length > 0) {
		process.exitCode = 1;
		return;
	}

	if (flags.has("--skip-validate")) {
		setValidationSkipped(true);
	}

	if (flags.has("--diff-debug")) {
		setDiffDebug(true);
	}

	const generatorFlags = new Set(PIPELINES.map((pipeline) => pipeline.flag));
	const noGeneratorFlag =
		![...generatorFlags].some((flag) => flags.has(flag)) && !flags.has("--all");

	const selected = PIPELINES.filter(
		(pipeline) =>
			flags.has("--all") ||
			flags.has(pipeline.flag) ||
			(noGeneratorFlag && pipeline.runInDefault),
	);

	await new Listr(
		selected.map((pipeline) => ({
			title: pipeline.name,
			exitOnError: false,
			task: (_ctx: unknown, task: TaskRunner) =>
				runStandardPipeline({
					task,
					outputDirs: pipeline.outputDirs,
					stages: pipeline.buildStages(),
				}),
		})),
		createRootListrOptions({
			concurrent: flags.has("--concurrent"),
			logLevel: "info",
		}),
	).run();
}

export function handleMainFailure(error: unknown): void {
	writeCliError(formatErrorMessage(error));
	if (env.VITE_LOG_LEVEL === "debug" && error instanceof Error && error.stack) {
		writeCliError(error.stack);
	}
	process.exitCode = 1;
}

export { main as runGenerators };

const isMainModule =
	process.argv[1] !== undefined &&
	fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMainModule) {
	void main().catch(handleMainFailure);
}
