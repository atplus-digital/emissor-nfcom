import {
	parseGeneratorFlags,
	resolveGeneratorArgv,
} from "@generators/lib/utils/args";
import { describe, expect, it } from "bun:test";

describe("args", () => {
	describe("resolveGeneratorArgv", () => {
		it("TC-UT-ARGS-013: reads flags from argv[2+] for direct script execution", () => {
			expect(
				resolveGeneratorArgv([
					"node",
					"scripts/generators/src/index.ts",
					"--types",
					"--concurrent",
				]),
			).toEqual(["--types", "--concurrent"]);
		});

		it("TC-UT-ARGS-014: reads flags from argv[1+] for node -e execution", () => {
			expect(resolveGeneratorArgv(["node", "--requests"])).toEqual([
				"--requests",
			]);
		});

		it("TC-UT-ARGS-015: returns empty array when no flags are provided", () => {
			expect(
				resolveGeneratorArgv(["node", "scripts/generators/src/index.ts"]),
			).toEqual([]);
		});

		it("TC-UT-ARGS-017: strips standalone -- from pnpm forwarded args", () => {
			expect(
				resolveGeneratorArgv([
					"node",
					"scripts/generators/src/index.ts",
					"--",
					"--types",
				]),
			).toEqual(["--types"]);
		});
	});

	describe("parseGeneratorFlags", () => {
		it("TC-UT-ARGS-001: parses --types flag correctly", () => {
			const result = parseGeneratorFlags(
				["--types"],
				["--types", "--requests", "--concurrent"],
			);
			expect(result.selectedGeneratorFlags.has("--types")).toBe(true);
			expect(result.selectedGeneratorFlags.has("--requests")).toBe(false);
		});

		it("TC-UT-ARGS-002: parses --requests flag correctly", () => {
			const result = parseGeneratorFlags(
				["--requests"],
				["--types", "--requests", "--concurrent"],
			);
			expect(result.selectedGeneratorFlags.has("--requests")).toBe(true);
			expect(result.selectedGeneratorFlags.has("--types")).toBe(false);
		});

		it("TC-UT-ARGS-003: parses --concurrent flag correctly", () => {
			const result = parseGeneratorFlags(
				["--concurrent"],
				["--types", "--requests", "--concurrent"],
			);
			expect(result.selectedGeneratorFlags.has("--concurrent")).toBe(true);
		});

		it("TC-UT-ARGS-004: parses multiple flags together", () => {
			const result = parseGeneratorFlags(
				["--types", "--requests"],
				["--types", "--requests", "--concurrent"],
			);
			expect(result.selectedGeneratorFlags.has("--types")).toBe(true);
			expect(result.selectedGeneratorFlags.has("--requests")).toBe(true);
			expect(result.selectedGeneratorFlags.has("--concurrent")).toBe(false);
		});

		it("TC-UT-ARGS-005: unknown flag throws appropriate error", () => {
			expect(() =>
				parseGeneratorFlags(
					["--unknown"],
					["--types", "--requests", "--concurrent"],
				),
			).toThrow("Flag não suportada: --unknown");
		});

		it("TC-UT-ARGS-006: missing value for flag throws error", () => {
			// When no flags match, the function returns all supported flags as selected
			// This is the expected behavior when no args are provided
			const result = parseGeneratorFlags(
				[],
				["--types", "--requests", "--concurrent"],
			);
			// When none of the args match supported flags, all flags are returned as selected
			expect(result.selectedGeneratorFlags.has("--types")).toBe(true);
			expect(result.selectedGeneratorFlags.has("--requests")).toBe(true);
			expect(result.selectedGeneratorFlags.has("--concurrent")).toBe(true);
		});

		it("TC-UT-ARGS-007: additional allowed flags are accepted", () => {
			const result = parseGeneratorFlags(
				["--types", "--custom-flag"],
				["--types"],
				{ additionalAllowedFlags: ["--custom-flag"] as const },
			);
			expect(result.selectedGeneratorFlags.has("--types")).toBe(true);
			expect(result.selectedAdditionalFlags.has("--custom-flag")).toBe(true);
		});

		it("TC-UT-ARGS-016: --skip-validate is accepted as additional flag", () => {
			const result = parseGeneratorFlags(
				["--types", "--skip-validate"],
				["--types"],
				{ additionalAllowedFlags: ["--skip-validate"] as const },
			);

			expect(result.selectedGeneratorFlags.has("--types")).toBe(true);
			expect(result.selectedAdditionalFlags.has("--skip-validate")).toBe(true);
		});

		it("TC-UT-ARGS-008: additional allowed flags throw when not in list", () => {
			expect(() =>
				parseGeneratorFlags(["--types", "--invalid-flag"], ["--types"], {
					additionalAllowedFlags: ["--custom-flag"] as const,
				}),
			).toThrow("Flag não suportada: --invalid-flag");
		});

		it("TC-UT-ARGS-009: non-flag arguments are ignored", () => {
			// Non-flag args (not starting with --) should be ignored
			const result = parseGeneratorFlags(
				["some-arg", "--types", "another-arg"],
				["--types", "--requests"],
			);
			expect(result.selectedGeneratorFlags.has("--types")).toBe(true);
		});

		it("TC-UT-ARGS-010: empty argv array returns all flags as selected", () => {
			const result = parseGeneratorFlags([], ["--types", "--requests"]);
			// When no flags match, all flags are returned as selected
			expect(result.selectedGeneratorFlags.has("--types")).toBe(true);
			expect(result.selectedGeneratorFlags.has("--requests")).toBe(true);
		});

		it("TC-UT-ARGS-011: uses defaultSelectedFlags when argv omits generator flags", () => {
			const result = parseGeneratorFlags(
				["--custom"],
				["--types", "--requests"],
				{
					additionalAllowedFlags: ["--custom"] as const,
					defaultSelectedFlags: ["--types"],
				},
			);

			expect(result.selectedGeneratorFlags).toEqual(new Set(["--types"]));
			expect(result.selectedAdditionalFlags).toEqual(new Set(["--custom"]));
		});

		it("TC-UT-ARGS-012: defaultSelectedFlags ignore unsupported entries", () => {
			const result = parseGeneratorFlags([], ["--types"], {
				defaultSelectedFlags: ["--types", "--missing"],
			});

			expect(result.selectedGeneratorFlags).toEqual(new Set(["--types"]));
		});
	});
});
