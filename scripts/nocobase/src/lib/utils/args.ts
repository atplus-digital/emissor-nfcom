export function resolveGeneratorArgv(argv: string[]): string[] {
	const trailingArgs = argv.slice(2).filter((arg) => arg !== "--");
	if (trailingArgs.length > 0) {
		return trailingArgs;
	}

	// node -e "..." --flags puts generator flags at argv[1] (Node 24+)
	return argv.slice(1).filter((arg) => arg.startsWith("--"));
}

type ParseGeneratorFlagsOptions<TExtraFlag extends string> = {
	additionalAllowedFlags?: readonly TExtraFlag[];
	defaultSelectedFlags?: readonly string[];
};

type ParseGeneratorFlagsResult<
	TFlag extends string,
	TExtraFlag extends string,
> = {
	selectedGeneratorFlags: Set<TFlag>;
	selectedAdditionalFlags: Set<TExtraFlag>;
};

export function parseGeneratorFlags<
	TFlag extends string,
	TExtraFlag extends string = never,
>(
	argv: string[],
	supportedFlags: readonly TFlag[],
	options: ParseGeneratorFlagsOptions<TExtraFlag> = {},
): ParseGeneratorFlagsResult<TFlag, TExtraFlag> {
	const args = new Set(argv);
	const additionalAllowedFlags = options.additionalAllowedFlags ?? [];
	const allowedFlagSet = new Set<string>([
		...supportedFlags,
		...additionalAllowedFlags,
	]);

	for (const arg of args) {
		if (!arg.startsWith("--")) {
			continue;
		}

		if (!allowedFlagSet.has(arg)) {
			throw new Error(
				`Flag não suportada: ${arg}. Use apenas ${[...supportedFlags, ...additionalAllowedFlags].join(" e/ou ")}.`,
			);
		}
	}

	const selectedFlags = supportedFlags.filter((flag) => args.has(flag));
	const selectedAdditionalFlags = additionalAllowedFlags.filter((flag) =>
		args.has(flag),
	);

	if (selectedFlags.length > 0) {
		return {
			selectedGeneratorFlags: new Set(selectedFlags),
			selectedAdditionalFlags: new Set(selectedAdditionalFlags),
		};
	}

	const defaultSelectedFlags = options.defaultSelectedFlags?.length
		? options.defaultSelectedFlags
		: supportedFlags;
	const fallbackSelectedFlags = defaultSelectedFlags.filter(
		(flag): flag is TFlag => supportedFlags.includes(flag as TFlag),
	);

	return {
		selectedGeneratorFlags: new Set(fallbackSelectedFlags),
		selectedAdditionalFlags: new Set(selectedAdditionalFlags),
	};
}
