import { describe, expect, it } from "bun:test";
import { parseCliArgs, resolveCliArgv } from "@generators/utils/args";

describe("args", () => {
	describe("resolveCliArgv", () => {
		it("TC-UT-ARGS-013: reads flags from argv[2+] for direct script execution", () => {
			expect(
				resolveCliArgv([
					"node",
					"scripts/generators/src/index.ts",
					"--types",
					"--concurrent",
				]),
			).toEqual(["--types", "--concurrent"]);
		});

		it("TC-UT-ARGS-014: reads flags from argv[1+] for node -e execution", () => {
			expect(resolveCliArgv(["node", "--types"])).toEqual(["--types"]);
		});

		it("TC-UT-ARGS-015: returns empty array when no flags are provided", () => {
			expect(
				resolveCliArgv(["node", "scripts/generators/src/index.ts"]),
			).toEqual([]);
		});

		it("TC-UT-ARGS-017: strips standalone -- from pnpm forwarded args", () => {
			expect(
				resolveCliArgv([
					"node",
					"scripts/generators/src/index.ts",
					"--",
					"--types",
				]),
			).toEqual(["--types"]);
		});
	});

	describe("parseCliArgs", () => {
		it("TC-UT-ARGS-001: accepts --types flag", () => {
			const result = parseCliArgs(["--types"]);
			expect(result.flags.has("--types")).toBe(true);
			expect(result.errors).toEqual([]);
		});

		it("TC-UT-ARGS-002: accepts all supported flags together", () => {
			const result = parseCliArgs([
				"--types",
				"--all",
				"--concurrent",
				"--skip-validate",
				"--diff-debug",
			]);
			expect([...result.flags].sort()).toEqual(
				[
					"--all",
					"--concurrent",
					"--diff-debug",
					"--skip-validate",
					"--types",
				].sort(),
			);
			expect(result.errors).toEqual([]);
		});

		it("TC-UT-ARGS-003: reports unsupported flag with the allowed set", () => {
			const result = parseCliArgs(["--requests"]);
			expect(result.flags).toEqual(new Set());
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0]).toContain("--requests");
			expect(result.errors[0]).toContain("--types");
			expect(result.errors[0]).toContain("--diff-debug");
		});

		it("TC-UT-ARGS-004: ignores non-flag arguments", () => {
			const result = parseCliArgs(["--types", "not-a-flag"]);
			expect(result.flags.has("--types")).toBe(true);
			expect(result.errors).toEqual([]);
		});

		it("TC-UT-ARGS-005: deduplicates repeated flags", () => {
			const result = parseCliArgs(["--types", "--types"]);
			expect(result.flags.has("--types")).toBe(true);
			expect(result.errors).toEqual([]);
		});
	});
});
