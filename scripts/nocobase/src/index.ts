import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { writeCliError } from "@generators/lib/cli/cli-output";
import { formatErrorMessage } from "@generators/lib/cli/format-error";
import { runOrchestrator } from "@generators/lib/pipeline/orchestrator";
import {
	parseGeneratorFlags,
	resolveGeneratorArgv,
} from "@generators/lib/utils/args";
import { env } from "@shared/utils/env";
import { GENERATOR_REGISTRY } from "./generator-registry";
import { setValidationSkipped } from "./lib/validation/validation-options";

const CONCURRENT_FLAG = "--concurrent" as const;
const ALL_FLAG = "--all" as const;
const SKIP_VALIDATE_FLAG = "--skip-validate" as const;

async function main(): Promise<void> {
	const registryFlags = GENERATOR_REGISTRY.map((entry) => entry.flag);
	const args = resolveGeneratorArgv(process.argv);
	const runAll = args.includes(ALL_FLAG);
	const defaultFlags = runAll
		? registryFlags
		: GENERATOR_REGISTRY.filter((entry) => entry.runInDefault).map(
				(entry) => entry.flag,
			);

	const { selectedGeneratorFlags, selectedAdditionalFlags } =
		parseGeneratorFlags(args, registryFlags, {
			additionalAllowedFlags: [CONCURRENT_FLAG, ALL_FLAG, SKIP_VALIDATE_FLAG],
			defaultSelectedFlags: defaultFlags,
		});

	if (selectedAdditionalFlags.has(SKIP_VALIDATE_FLAG)) {
		setValidationSkipped(true);
	}

	const generators = GENERATOR_REGISTRY.filter((entry) =>
		selectedGeneratorFlags.has(entry.flag),
	).map((entry) => entry.definition);

	await runOrchestrator(generators, {
		concurrent: selectedAdditionalFlags.has(CONCURRENT_FLAG),
	});
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
