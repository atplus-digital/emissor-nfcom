import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi,
	mock,
} from "bun:test";

mock.module("@shared/utils/env", () => ({
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

mock.module("@generators/lib/cli/cli-output", () => ({
	writeCliError: vi.fn(),
}));

mock.module("@generators/lib/cli/format-error", () => ({
	formatErrorMessage: vi.fn((error: unknown) =>
		error instanceof Error ? error.message : String(error),
	),
}));

mock.module("@generators/lib/pipeline/orchestrator", () => ({
	runOrchestrator: vi.fn(async () => undefined),
}));

import { writeCliError } from "@generators/lib/cli/cli-output";
import { runOrchestrator } from "@generators/lib/pipeline/orchestrator";
import { env } from "@shared/utils/env";
import { handleMainFailure, runGenerators } from "./index";
import { isDiffDebug, setDiffDebug } from "./lib/validation/diff-debug-options";
import {
	isValidationSkipped,
	setValidationSkipped,
} from "./lib/validation/validation-options";

describe("generators index main()", () => {
	const originalArgv = process.argv;

	beforeEach(() => {
		runOrchestrator.mockClear();
		writeCliError.mockClear();
		// Zera o estado de módulo das flags adicionais para não vazar entre testes
		setValidationSkipped(false);
		setDiffDebug(false);
	});

	afterEach(() => {
		setValidationSkipped(false);
		setDiffDebug(false);
		vi.restoreAllMocks();
		// bun: vi.spyOn não suporta accessor (process.argv) — restaura via defineProperty
		Object.defineProperty(process, "argv", {
			value: originalArgv,
			configurable: true,
			writable: true,
		});
	});

	function stubArgv(argv: string[]) {
		Object.defineProperty(process, "argv", {
			value: argv,
			configurable: true,
			writable: true,
		});
	}

	it("runs default generators when no flags are provided", async () => {
		stubArgv(["node", "scripts/generators/src/index.ts"]);

		await runGenerators();

		expect(runOrchestrator).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({ name: "generate-types" }),
			]),
			{ concurrent: false },
		);
	});

	it("runs only selected generators from argv flags", async () => {
		stubArgv(["node", "scripts/generators/src/index.ts", "--types"]);

		await runGenerators();

		expect(runOrchestrator).toHaveBeenCalledWith(
			[expect.objectContaining({ name: "generate-types" })],
			{ concurrent: false },
		);
	});

	it("runs all generators when --all is passed", async () => {
		stubArgv(["node", "scripts/generators/src/index.ts", "--all"]);

		await runGenerators();

		expect(runOrchestrator).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({ name: "generate-types" }),
			]),
			{ concurrent: false },
		);
	});

	it("passes concurrent mode when --concurrent is provided", async () => {
		stubArgv([
			"node",
			"scripts/generators/src/index.ts",
			"--types",
			"--concurrent",
		]);

		await runGenerators();

		expect(runOrchestrator).toHaveBeenCalledWith(expect.any(Array), {
			concurrent: true,
		});
	});

	it("ativa skip de validação quando --skip-validate é passado", async () => {
		stubArgv([
			"node",
			"scripts/generators/src/index.ts",
			"--types",
			"--skip-validate",
		]);

		await runGenerators();

		expect(isValidationSkipped()).toBe(true);
	});

	it("ativa diff-debug quando --diff-debug é passado", async () => {
		stubArgv([
			"node",
			"scripts/generators/src/index.ts",
			"--types",
			"--diff-debug",
		]);

		await runGenerators();

		expect(isDiffDebug()).toBe(true);
	});
});

describe("handleMainFailure", () => {
	beforeEach(() => {
		process.exitCode = 0;
		writeCliError.mockClear();
	});

	afterEach(() => {
		process.exitCode = 0;
	});

	it("registra stack trace em modo debug quando main falha", () => {
		env.VITE_LOG_LEVEL = "debug";

		const error = new Error("pipeline failed");
		handleMainFailure(error);

		expect(writeCliError).toHaveBeenCalledTimes(2);
		expect(process.exitCode).toBe(1);
		expect(writeCliError.mock.calls[0]?.[0]).toBe("pipeline failed");
		expect(writeCliError.mock.calls[1]?.[0]).toContain("Error:");
	});

	it("registra apenas mensagem formatada quando main falha fora do modo debug", () => {
		env.VITE_LOG_LEVEL = "info";

		handleMainFailure(new Error("pipeline failed"));

		expect(writeCliError).toHaveBeenCalledTimes(1);
		expect(process.exitCode).toBe(1);
		expect(writeCliError.mock.calls[0]?.[0]).toBe("pipeline failed");
	});

	it("nao registra stack trace para erros nao-Error em modo debug", () => {
		env.VITE_LOG_LEVEL = "debug";

		handleMainFailure("plain failure");

		expect(writeCliError).toHaveBeenCalledTimes(1);
		expect(process.exitCode).toBe(1);
		expect(writeCliError.mock.calls[0]?.[0]).toBe("plain failure");
	});
});
