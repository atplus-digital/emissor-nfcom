import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@shared/utils/env", () => ({
	env: {
		VITE_LOG_LEVEL: "info",
	},
	resolveNocoBaseEnv: vi.fn(() => ({
		baseUrl: "https://nocobase.test/api",
		token: "token",
		timeoutMs: 5000,
		logLevel: "silent",
	})),
}));

vi.mock("@generators/lib/cli/cli-output", () => ({
	writeCliError: vi.fn(),
}));

vi.mock("@generators/lib/cli/format-error", () => ({
	formatErrorMessage: vi.fn((error: unknown) =>
		error instanceof Error ? error.message : String(error),
	),
}));

vi.mock("@generators/lib/pipeline/orchestrator", () => ({
	runOrchestrator: vi.fn(async () => undefined),
}));

import { writeCliError } from "@generators/lib/cli/cli-output";
import { runOrchestrator } from "@generators/lib/pipeline/orchestrator";
import { env } from "@shared/utils/env";
import { handleMainFailure, runGenerators } from "./index";

describe("generators index main()", () => {
	beforeEach(() => {
		vi.mocked(runOrchestrator).mockClear();
		vi.mocked(writeCliError).mockClear();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("runs default generators when no flags are provided", async () => {
		const argvSpy = vi
			.spyOn(process, "argv", "get")
			.mockReturnValue(["node", "scripts/generators/src/index.ts"]);

		await runGenerators();

		expect(runOrchestrator).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({ name: "generate-types" }),
			]),
			{ concurrent: false },
		);

		argvSpy.mockRestore();
	});

	it("runs only selected generators from argv flags", async () => {
		const argvSpy = vi
			.spyOn(process, "argv", "get")
			.mockReturnValue(["node", "scripts/generators/src/index.ts", "--types"]);

		await runGenerators();

		expect(runOrchestrator).toHaveBeenCalledWith(
			[expect.objectContaining({ name: "generate-types" })],
			{ concurrent: false },
		);

		argvSpy.mockRestore();
	});

	it("runs all generators when --all is passed", async () => {
		const argvSpy = vi
			.spyOn(process, "argv", "get")
			.mockReturnValue(["node", "scripts/generators/src/index.ts", "--all"]);

		await runGenerators();

		expect(runOrchestrator).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({ name: "generate-types" }),
			]),
			{ concurrent: false },
		);

		argvSpy.mockRestore();
	});

	it("passes concurrent mode when --concurrent is provided", async () => {
		const argvSpy = vi
			.spyOn(process, "argv", "get")
			.mockReturnValue([
				"node",
				"scripts/generators/src/index.ts",
				"--types",
				"--concurrent",
			]);

		await runGenerators();

		expect(runOrchestrator).toHaveBeenCalledWith(expect.any(Array), {
			concurrent: true,
		});

		argvSpy.mockRestore();
	});
});

describe("handleMainFailure", () => {
	beforeEach(() => {
		process.exitCode = 0;
		vi.mocked(writeCliError).mockClear();
	});

	it("registra stack trace em modo debug quando main falha", () => {
		env.VITE_LOG_LEVEL = "debug";

		const error = new Error("pipeline failed");
		handleMainFailure(error);

		expect(writeCliError).toHaveBeenCalledTimes(2);
		expect(process.exitCode).toBe(1);
		expect(vi.mocked(writeCliError).mock.calls[0]?.[0]).toBe("pipeline failed");
		expect(vi.mocked(writeCliError).mock.calls[1]?.[0]).toContain("Error:");
	});

	it("registra apenas mensagem formatada quando main falha fora do modo debug", () => {
		env.VITE_LOG_LEVEL = "info";

		handleMainFailure(new Error("pipeline failed"));

		expect(writeCliError).toHaveBeenCalledTimes(1);
		expect(process.exitCode).toBe(1);
		expect(vi.mocked(writeCliError).mock.calls[0]?.[0]).toBe("pipeline failed");
	});

	it("nao registra stack trace para erros nao-Error em modo debug", () => {
		env.VITE_LOG_LEVEL = "debug";

		handleMainFailure("plain failure");

		expect(writeCliError).toHaveBeenCalledTimes(1);
		expect(process.exitCode).toBe(1);
		expect(vi.mocked(writeCliError).mock.calls[0]?.[0]).toBe("plain failure");
	});
});
