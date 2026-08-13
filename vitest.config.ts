import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	root: path.resolve(import.meta.dirname),
	test: {
		include: [
			"scripts/nocobase/**/*.{test,spec}.{js,ts}",
			"src/**/*.{test,spec}.{js,ts}",
		],
		environment: "node",
		// threads avoids forked workers deleting `.vitest-coverage/.tmp` mid-run
		pool: "threads",
		maxWorkers: 1,
		fileParallelism: false,
		passWithNoTests: true,
		onConsoleLog() {
			return false;
		},
		coverage: {
			provider: "v8",
			reportsDirectory: "./.vitest-coverage",
			reporter: ["text", "json-summary", "html-spa"],
			include: ["src/**/*.ts", "config/**/*.ts"],
			exclude: [
				"**/*.d.ts",
				"**/*.test.ts",
				"**/*.spec.ts",
				"**/test/**",
				"src/**/@types/**",
			],
			thresholds: {
				lines: 90,
				statements: 90,
				functions: 90,
				branches: 90,
			},
		},
	},
	resolve: {
		alias: {
			"@generators": path.resolve(import.meta.dirname, "./scripts/nocobase/src/"),
			"@shared/types": path.resolve(import.meta.dirname, "./scripts/nocobase/types.ts"),
			"@shared": path.resolve(import.meta.dirname, "./scripts/nocobase/src/"),
		},
	},
});
