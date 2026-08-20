import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	mock,
	vi,
} from "bun:test";

const runStandardPipelineMock = vi.fn(() => ({ run: vi.fn() }));
const buildStagesMock = vi.fn(() => [vi.fn()]);
const createRootListrOptionsMock = vi.fn(() => ({
	concurrent: false,
	renderer: "default",
	rendererOptions: {},
}));

mock.module("@generators/utils/env", () => ({
	env: {
		VITE_LOG_LEVEL: "info",
	},
}));

mock.module("@generators/cli/cli-output", () => ({
	writeCliError: vi.fn(),
}));

mock.module("@generators/cli/format-error", () => ({
	formatErrorMessage: vi.fn((error: unknown) =>
		error instanceof Error ? error.message : String(error),
	),
}));

mock.module("@generators/cli/listr-config", () => ({
	createRootListrOptions: createRootListrOptionsMock,
}));

mock.module("@generators/lifecycle/lifecycle", () => ({
	runStandardPipeline: runStandardPipelineMock,
}));

mock.module("./pipelines", () => ({
	PIPELINES: [
		{
			name: "generate-types",
			description: "test",
			flag: "--types",
			runInDefault: true,
			outputDirs: ["packages/generated/types/nocobase/"],
			buildStages: buildStagesMock,
		},
	],
}));

import { writeCliError } from "@generators/cli/cli-output";
import { runStandardPipeline } from "@generators/lifecycle/lifecycle";
import { env } from "@generators/utils/env";
import { handleMainFailure, runGenerators } from "./index";
import { isDiffDebug, isValidationSkipped, setDiffDebug, setValidationSkipped } from "./src/cli/flags";


describe("generators index main()", () => {
	const originalArgv = process.argv;

	function stubArgv(argv: string[]) {
		Object.defineProperty(process, "argv", {
			value: argv,
			configurable: true,
			writable: true,
		});
	}

	beforeEach(() => {
		vi.clearAllMocks();
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

	it("runs default pipelines when no flags are provided", async () => {
		stubArgv(["node", "scripts/nocobase/index.ts"]);

		await runGenerators();

		expect(runStandardPipeline).toHaveBeenCalledTimes(1);
		expect(runStandardPipeline).toHaveBeenCalledWith(
			expect.objectContaining({
				outputDirs: ["packages/generated/types/nocobase/"],
				stages: expect.any(Array),
			}),
		);
	});

	it("runs the pipeline selected by --types", async () => {
		stubArgv(["node", "scripts/nocobase/index.ts", "--types"]);

		await runGenerators();

		expect(runStandardPipeline).toHaveBeenCalledTimes(1);
		expect(buildStagesMock).toHaveBeenCalled();
	});

	it("runs all pipelines when --all is passed", async () => {
		stubArgv(["node", "scripts/nocobase/index.ts", "--all"]);

		await runGenerators();

		expect(runStandardPipeline).toHaveBeenCalledTimes(1);
	});

	it("passes concurrent mode when --concurrent is provided", async () => {
		stubArgv(["node", "scripts/nocobase/index.ts", "--concurrent"]);

		await runGenerators();

		expect(createRootListrOptionsMock).toHaveBeenCalledWith(
			expect.objectContaining({ concurrent: true }),
		);
	});

	it("ativa skip de validação quando --skip-validate é passado", async () => {
		stubArgv(["node", "scripts/nocobase/index.ts", "--skip-validate"]);

		await runGenerators();

		expect(isValidationSkipped()).toBe(true);
	});

	it("ativa diff-debug quando --diff-debug é passado", async () => {
		stubArgv(["node", "scripts/nocobase/index.ts", "--diff-debug"]);

		await runGenerators();

		expect(isDiffDebug()).toBe(true);
	});

	it("rejeita flag desconhecida e não roda pipelines", async () => {
		stubArgv(["node", "scripts/nocobase/index.ts", "--requests"]);

		await runGenerators();

		expect(writeCliError).toHaveBeenCalledTimes(1);
		expect(writeCliError.mock.calls[0]?.[0]).toContain("--requests");
		expect(process.exitCode).toBe(1);
		expect(runStandardPipeline).not.toHaveBeenCalled();
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
