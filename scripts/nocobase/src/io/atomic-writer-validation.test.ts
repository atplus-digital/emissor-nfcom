import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	mock,
	vi,
} from "bun:test";

mock.module("@generators/cli/cli-output", () => ({
	writeCliError: vi.fn(),
}));

mock.module("@generators/validation/linter-runner", () => ({
	runLinterFix: vi.fn(async () => undefined),
}));

mock.module("@generators/validation/tsc-validator", () => ({
	validateTypeScriptDirectory: vi.fn(async () => true),
	validateTypeScriptFiles: vi.fn(async () => true),
}));

import { writeCliError } from "@generators/cli/cli-output";
import { runLinterFix } from "@generators/validation/linter-runner";
import {
	validateTypeScriptDirectory,
	validateTypeScriptFiles,
} from "@generators/validation/tsc-validator";
import { runValidation } from "./atomic-writer";

describe("atomic-writer runValidation", () => {
	beforeEach(() => {
		validateTypeScriptDirectory.mockReset();
		validateTypeScriptFiles.mockReset();
		runLinterFix.mockReset();
		writeCliError.mockReset();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns true when validation and lint succeed", async () => {
		validateTypeScriptDirectory.mockResolvedValue(true);

		const result = await runValidation("/tmp/generated");

		expect(result).toBe(true);
		expect(validateTypeScriptDirectory).toHaveBeenCalledWith("/tmp/generated");
		expect(runLinterFix).toHaveBeenCalledWith(["/tmp/generated"]);
	});

	it("returns false and prints error when TypeScript validation fails", async () => {
		validateTypeScriptDirectory.mockResolvedValue(false);

		const result = await runValidation("/tmp/generated");

		expect(result).toBe(false);
		expect(writeCliError).toHaveBeenCalledWith(
			"❌ Validação TypeScript falhou.",
		);
		expect(runLinterFix).not.toHaveBeenCalled();
	});

	it("validates changed files and lints affected directories for a target plan", async () => {
		validateTypeScriptFiles.mockResolvedValue(true);

		const result = await runValidation({
			files: ["/tmp/generated/a.ts"],
			lintDirs: ["/tmp/generated"],
		});

		expect(result).toBe(true);
		expect(validateTypeScriptFiles).toHaveBeenCalledWith([
			"/tmp/generated/a.ts",
		]);
		expect(runLinterFix).toHaveBeenCalledWith(["/tmp/generated"]);
	});
});
