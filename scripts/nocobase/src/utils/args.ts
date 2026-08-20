/** Generator selection flags (one per registered pipeline + `--all`). */
export const GENERATOR_FLAGS = ["--types", "--all"] as const;

/** Modifier flags (do not select pipelines). */
export const MODIFIER_FLAGS = [
	"--concurrent",
	"--skip-validate",
	"--diff-debug",
] as const;

const ALL_ALLOWED_FLAGS: readonly string[] = [
	...GENERATOR_FLAGS,
	...MODIFIER_FLAGS,
];

export function resolveCliArgv(argv: string[]): string[] {
	const trailingArgs = argv.slice(2).filter((arg) => arg !== "--");
	if (trailingArgs.length > 0) {
		return trailingArgs;
	}

	// node -e "..." --flags puts generator flags at argv[1] (Node 24+)
	return argv.slice(1).filter((arg) => arg.startsWith("--"));
}

export interface ParsedCliArgs {
	/** Accepted flags present in argv. */
	flags: Set<string>;
	/** One error message per unsupported flag. */
	errors: string[];
}

/**
 * Validates argv against the fixed flag set and collects the accepted ones.
 * Unsupported flags are reported in `errors` (caller decides how to surface).
 */
export function parseCliArgs(argv: string[]): ParsedCliArgs {
	const flags = new Set<string>();
	const errors: string[] = [];

	for (const arg of argv) {
		if (!arg.startsWith("--")) {
			continue;
		}

		if (!ALL_ALLOWED_FLAGS.includes(arg)) {
			errors.push(
				`Flag não suportada: ${arg}. Use apenas ${ALL_ALLOWED_FLAGS.join(
					" e/ou ",
				)}.`,
			);
			continue;
		}

		flags.add(arg);
	}

	return { flags, errors };
}
