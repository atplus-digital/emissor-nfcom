import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockLoadDotEnv } = vi.hoisted(() => ({
	mockLoadDotEnv: vi.fn(),
}));

vi.mock("dotenv", () => ({
	config: mockLoadDotEnv,
}));

const VALID_ENV = {
	NOCOBASE_API_URL: "http://localhost:13000",
	NOCOBASE_API_KEY: "test-token",
} as const;

describe("env", () => {
	const originalEnv = { ...process.env };

	beforeEach(() => {
		vi.resetModules();
		mockLoadDotEnv.mockClear();
		process.env = { ...VALID_ENV };
	});

	afterEach(() => {
		process.env = originalEnv;
		vi.restoreAllMocks();
	});

	async function importEnvModule(
		envVars: Record<string, string | undefined> = { ...VALID_ENV },
	) {
		process.env = { ...envVars };
		return import("./env");
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
