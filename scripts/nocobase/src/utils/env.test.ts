import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi,
	mock,
} from "bun:test";

const mockLoadDotEnv = vi.fn();

mock.module("dotenv", () => ({
	config: mockLoadDotEnv,
}));

const VALID_ENV = {
	NOCOBASE_API_URL: "http://localhost:13000",
	NOCOBASE_API_KEY: "test-token",
} as const;

// Importa o módulo canônico uma única vez para cobrir o corpo de
// resolveNocoBaseEnv (linhas 57-65). O import com query-string usado nos testes
// de erro re-executa o top-level, mas a cobertura do corpo da função não é
// atribuída de forma confiável a essas re-importações.
import * as envModule from "./env";

describe("env", () => {
	const originalEnv = { ...process.env };

	beforeEach(() => {
		mockLoadDotEnv.mockClear();
		process.env = { ...VALID_ENV };
	});

	afterEach(() => {
		process.env = originalEnv;
		vi.restoreAllMocks();
	});

	// bun: re-import com query-string re-executa o top-level do módulo
	// (que chama loadDotEnv), equivalente ao resetModules de outros runners.
	let envImportCounter = 0;
	async function importEnvModule(
		envVars: Record<string, string | undefined> = { ...VALID_ENV },
	) {
		process.env = { ...envVars };
		envImportCounter += 1;
		return import(`./env?fresh=${envImportCounter}`);
	}

	describe("dotenv loading", () => {
		it("TC-UT-ENV-001: loads .env.local and .env from repo root", async () => {
			await importEnvModule();

			const currentFileDir = path.dirname(
				fileURLToPath(new URL("./env.ts", import.meta.url)),
			);
			const repoRoot = path.resolve(currentFileDir, "../../../../");

			expect(mockLoadDotEnv).toHaveBeenCalledTimes(2);
			expect(mockLoadDotEnv).toHaveBeenNthCalledWith(1, {
				path: path.resolve(repoRoot, ".env.local"),
				quiet: true,
			});
			expect(mockLoadDotEnv).toHaveBeenNthCalledWith(2, {
				path: path.resolve(repoRoot, ".env"),
				quiet: true,
			});
		});
	});

	describe("resolveNocoBaseEnv", () => {
		it("TC-UT-ENV-002: returns validated values when env is valid", async () => {
			const { resolveNocoBaseEnv } = await importEnvModule({
				...VALID_ENV,
				VITE_LOG_LEVEL: "debug",
			});
			const result = resolveNocoBaseEnv();

			expect(result).toEqual({
				baseUrl: "http://localhost:13000",
				token: "test-token",
				timeoutMs: 15_000,
				logLevel: "debug",
			});
		});

		it("TC-UT-ENV-003: strips trailing slashes from URL", async () => {
			const { resolveNocoBaseEnv } = await importEnvModule({
				...VALID_ENV,
				NOCOBASE_API_URL: "http://localhost:13000///",
			});
			const result = resolveNocoBaseEnv();

			expect(result.baseUrl).toBe("http://localhost:13000");
			expect(result.baseUrl).not.toMatch(/\/$/);
		});

		it("TC-UT-ENV-004: uses fixed 15s timeout", async () => {
			const { resolveNocoBaseEnv } = await importEnvModule();
			const result = resolveNocoBaseEnv();

			expect(result.timeoutMs).toBe(15_000);
			expect(typeof result.timeoutMs).toBe("number");
		});

		it("TC-UT-ENV-005: defaults VITE_LOG_LEVEL to info", async () => {
			const { resolveNocoBaseEnv } = await importEnvModule();
			const result = resolveNocoBaseEnv();

			expect(result.logLevel).toBe("info");
		});

		it("TC-UT-ENV-006: accepts debug VITE_LOG_LEVEL", async () => {
			const { resolveNocoBaseEnv } = await importEnvModule({
				...VALID_ENV,
				VITE_LOG_LEVEL: "debug",
			});
			const result = resolveNocoBaseEnv();

			expect(result.logLevel).toBe("debug");
		});

		it("TC-UT-ENV-007: trims whitespace from token", async () => {
			const { resolveNocoBaseEnv } = await importEnvModule({
				...VALID_ENV,
				NOCOBASE_API_KEY: "  padded-token  ",
			});
			const result = resolveNocoBaseEnv();

			expect(result.token).toBe("padded-token");
		});

		it("TC-UT-ENV-008: exposes validated env object", async () => {
			const { env } = await importEnvModule();

			expect(env.NOCOBASE_API_URL).toBe("http://localhost:13000");
			expect(env.NOCOBASE_API_KEY).toBe("test-token");
			expect(env.VITE_LOG_LEVEL).toBe("info");
		});

		it("TC-UT-ENV-013: includes X-App requestHeaders when NOCOBASE_APP is set", async () => {
			const { resolveNocoBaseEnv } = await importEnvModule({
				...VALID_ENV,
				NOCOBASE_APP: "a_atacado",
			});
			const result = resolveNocoBaseEnv();

			expect(result.requestHeaders).toEqual({ "X-App": "a_atacado" });
		});

		it("TC-UT-ENV-014: omits requestHeaders when NOCOBASE_APP is unset", async () => {
			const { resolveNocoBaseEnv } = await importEnvModule();
			const result = resolveNocoBaseEnv();

			expect(result.requestHeaders).toBeUndefined();
		});

		it("TC-UT-ENV-015: resolveNocoBaseEnv (canonical import) returns the resolved shape", () => {
			process.env = { ...VALID_ENV, NOCOBASE_APP: "a_atacado" };
			const result = envModule.resolveNocoBaseEnv();

			// O módulo canônico carrega o env no top-level; aqui validamos apenas a
			// estrutura retornada (timeout fixo + escalamento dos demais campos).
			expect(result).toMatchObject({
				timeoutMs: 15_000,
			});
			expect(typeof result.baseUrl).toBe("string");
			expect(typeof result.token).toBe("string");
			expect(["info", "debug"]).toContain(result.logLevel);
		});
	});

	describe("onValidationError", () => {
		it("TC-UT-ENV-009: throws when NOCOBASE_API_URL is invalid", async () => {
			const consoleErrorSpy = vi
				.spyOn(console, "error")
				.mockImplementation(() => {});

			await expect(
				importEnvModule({
					...VALID_ENV,
					NOCOBASE_API_URL: "not-a-url",
				}),
			).rejects.toThrow("Invalid environment variables");
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"Invalid environment variables:",
				expect.any(String),
			);
		});

		it("TC-UT-ENV-010: throws when NOCOBASE_API_KEY is missing", async () => {
			const consoleErrorSpy = vi
				.spyOn(console, "error")
				.mockImplementation(() => {});

			await expect(
				importEnvModule({
					NOCOBASE_API_URL: VALID_ENV.NOCOBASE_API_URL,
				}),
			).rejects.toThrow("Invalid environment variables");
			expect(consoleErrorSpy).toHaveBeenCalled();
		});

		it("TC-UT-ENV-011: throws when NOCOBASE_API_KEY is empty", async () => {
			await expect(
				importEnvModule({
					...VALID_ENV,
					NOCOBASE_API_KEY: "",
				}),
			).rejects.toThrow("Invalid environment variables");
		});

		it("TC-UT-ENV-012: throws when VITE_LOG_LEVEL is invalid", async () => {
			await expect(
				importEnvModule({
					...VALID_ENV,
					VITE_LOG_LEVEL: "trace",
				}),
			).rejects.toThrow("Invalid environment variables");
		});
	});
});
