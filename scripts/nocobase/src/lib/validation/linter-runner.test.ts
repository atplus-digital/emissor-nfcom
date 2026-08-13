import { isPnpmCommand } from "@generators/test/path-helpers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock execFile from node:child_process
const mockExecFile = vi.fn();
vi.mock("node:child_process", async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...(actual as object),
		execFile: (...args: unknown[]) => mockExecFile(...args),
		default: {
			...(actual as object),
			execFile: (...args: unknown[]) => mockExecFile(...args),
		},
	};
});

import { runLinterFix } from "./linter-runner";

function findPnpmCall(predicate: (args: string[]) => boolean) {
	return mockExecFile.mock.calls.find(
		(call) =>
			isPnpmCommand(call[0] as string) && predicate(call[1] as string[]),
	);
}

describe("linter-runner", () => {
	beforeEach(() => {
		mockExecFile.mockReset();
		// Default: successful execution
		mockExecFile.mockImplementation(
			(
				_cmd: string,
				_args: string[],
				_opts: unknown,
				cb: (err: Error | null, stdout: string, stderr: string) => void,
			) => {
				cb(null, "", "");
			},
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	// TC-UT-LINT-001: Empty dirs array returns early without calling biome
	it("TC-UT-LINT-001: should return early when dirs array is empty", async () => {
		// Act
		const result = await runLinterFix([]);

		// Assert - should return undefined (void function) without calling execFile
		expect(result).toBeUndefined();
		expect(mockExecFile).not.toHaveBeenCalled();
	});

	// TC-UT-LINT-002: biome is called with provided directories
	it("TC-UT-LINT-002: should call biome with provided directories", async () => {
		// Arrange
		const dirs = ["/tmp/src/test-dir"];

		// Act
		await runLinterFix(dirs);

		// Assert - biome (pnpm exec biome) should be called
		const biomeCall = findPnpmCall((args) => args.includes("biome"));
		expect(biomeCall).toBeDefined();
		const [, args] = biomeCall as [string, string[]];
		expect(args).toContain("exec");
		expect(args).toContain("biome");
		expect(args).toContain("check");
		expect(args).toContain("--write");
		expect(args).toContain("--vcs-use-ignore-file=false");
		expect(args).toContain("/tmp/src/test-dir");
	});

	// TC-UT-LINT-003: prettier is called for markdown files
	it("TC-UT-LINT-003: should call prettier for markdown directories", async () => {
		// Arrange
		const dirs = ["/tmp/src/md-dir"];

		// Act
		await runLinterFix(dirs);

		// Assert - prettier (pnpm dlx prettier) should be called
		const prettierCall = findPnpmCall((args) => args.includes("prettier"));
		expect(prettierCall).toBeDefined();
		const [, args] = prettierCall as [string, string[]];
		expect(args).toContain("dlx");
		expect(args).toContain("prettier");
		expect(args).toContain("--write");
		expect(args).toContain("--no-error-on-unmatched-pattern");
		// Should have markdown glob
		const mdGlob = args.find((a: string) => a.includes(".md"));
		expect(mdGlob).toBeDefined();
	});

	// TC-UT-LINT-004: biome failure throws error
	it("TC-UT-LINT-004: should throw when biome fails", async () => {
		// Arrange
		mockExecFile.mockImplementation(
			(
				cmd: string,
				args: string[],
				_opts: unknown,
				cb: (err: Error | null, stdout: string, stderr: string) => void,
			) => {
				if (isPnpmCommand(cmd) && args.includes("biome")) {
					cb(new Error("biome not found"), "", "");
					return;
				}
				cb(null, "", "");
			},
		);

		// Act & Assert
		await expect(runLinterFix(["/tmp/test"])).rejects.toThrow("biome");
	});

	// TC-UT-LINT-005: multiple directories are all passed to biome
	it("TC-UT-LINT-005: should pass all directories to biome", async () => {
		// Arrange
		const dirs = ["/tmp/dir1", "/tmp/dir2", "/tmp/dir3"];

		// Act
		await runLinterFix(dirs);

		// Assert - biome should be called with all directories
		const biomeCall = findPnpmCall((args) => args.includes("biome"));
		expect(biomeCall).toBeDefined();
		const [, args] = biomeCall as [string, string[]];
		expect(args).toContain("/tmp/dir1");
		expect(args).toContain("/tmp/dir2");
		expect(args).toContain("/tmp/dir3");
	});
});
