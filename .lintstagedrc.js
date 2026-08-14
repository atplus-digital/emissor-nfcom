/** @type {import('lint-staged').Configuration} */
export default {
	"*.{json,jsonc,js,ts,jsx,tsx}": (files) =>
		`bunx biome check --write --no-errors-on-unmatched ${files.map((file) => JSON.stringify(file)).join(" ")}`,
	"*.{md,mdx}": "bun format:md",
	"*.{js,ts,jsx,tsx}": (files) => {
		const commands = ["tsc-files --noEmit"];
		// `bun test` sem arquivo `.test.*` staged (ex.: só `src/env.ts`) termina com
		// "No tests found" e exit 1 — roda o teste só quando há teste staged.
		const hasTests = files.some((file) => /\.(test|spec)\.(js|ts|jsx|tsx)$/.test(file));
		if (hasTests) {
			commands.push(`bun test --isolate ${files.map((file) => JSON.stringify(file)).join(" ")}`);
		}
		return commands;
	},
};
