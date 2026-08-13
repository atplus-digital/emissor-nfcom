import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@generators/lib/cli/cli-output", () => ({
	writeCliError: vi.fn(),
}));

vi.mock("@generators/lib/validation/linter-runner", () => ({
	runLinterFix: vi.fn(async () => undefined),
}));

vi.mock("@generators/lib/validation/tsc-validator", () => ({
	validateTypeScriptDirectory: vi.fn(async () => true),
	validateTypeScriptFiles: vi.fn(async () => true),
}));

import { writeCliError } from "@generators/lib/cli/cli-output";
import { runLinterFix } from "@generators/lib/validation/linter-runner";
import {
	validateTypeScriptDirectory,
	validateTypeScriptFiles,
} from "@generators/lib/validation/tsc-validator";
import { runValidation } from "./atomic-writer";

describe("atomic-writer runValidation", () => {
	beforeEach(() => {
		vi.mocked(validateTypeScriptDirectory).mockReset();
		vi.mocked(validateTypeScriptFiles).mockReset();
		vi.mocked(runLinterFix).mockReset();
		vi.mocked(writeCliError).mockReset();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns true when validation and lint succeed", async () => {
		vi.mocked(validateTypeScriptDirectory).mockResolvedValue(true);

		const result = await runValidation("/tmp/generated");

		expect(result).toBe(true);
		expect(validateTypeScriptDirectory).toHaveBeenCalledWith("/tmp/generated");
		expect(runLinterFix).toHaveBeenCalledWith(["/tmp/generated"]);
	});

	it("returns false and prints error when TypeScript validation fails", async () => {
		vi.mocked(validateTypeScriptDirectory).mockResolvedValue(false);

		const result = await runValidation("/tmp/generated");

		expect(result).toBe(false);
		expect(writeCliError).toHaveBeenCalledWith(
			"❌ Validação TypeScript falhou.",
		);
		expect(runLinterFix).not.toHaveBeenCalled();
	});

	it("skips validation and lint when disabled via options", async () => {
		const result = await runValidation("/tmp/generated", {
			validate: false,
			lint: false,
		});

		expect(result).toBe(true);
		expect(validateTypeScriptDirectory).not.toHaveBeenCalled();
		expect(runLinterFix).not.toHaveBeenCalled();
	});

	it("skips TypeScript validation but still runs lint when validate is false", async () => {
		const result = await runValidation("/tmp/generated", {
			validate: false,
			lint: true,
		});

		expect(result).toBe(true);
		expect(validateTypeScriptDirectory).not.toHaveBeenCalled();
		expect(runLinterFix).toHaveBeenCalledWith(["/tmp/generated"]);
	});

	it("runs validation but skips lint when lint is false", async () => {
		vi.mocked(validateTypeScriptFiles).mockResolvedValue(true);

		const result = await runValidation(
			{
				files: ["/tmp/generated/a.ts"],
				lintDirs: ["/tmp/generated"],
			},
			{
				validate: true,
				lint: false,
			},
		);

		expect(result).toBe(true);
		expect(validateTypeScriptFiles).toHaveBeenCalledWith([
			"/tmp/generated/a.ts",
		]);
		expect(runLinterFix).not.toHaveBeenCalled();
	});
});
