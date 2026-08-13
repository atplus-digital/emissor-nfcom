/** @type {import('lint-staged').Configuration} */
export default {
	"*.{json,jsonc,js,ts,jsx,tsx}": (files) =>
		`bunx biome check --write --no-errors-on-unmatched ${files.map((file) => JSON.stringify(file)).join(" ")}`,
	"*.{md,mdx}": "bun format:md",
	"*.{js,ts,jsx,tsx}": ["tsc-files --noEmit", "bun test-staged"],
};
