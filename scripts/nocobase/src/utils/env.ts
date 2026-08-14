import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { createEnv } from "@t3-oss/env-core";
import { config as loadDotEnv } from "dotenv";
import { z } from "zod";

const currentFileDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentFileDir, "../../../../");

// Carrega somente os arquivos de ambiente da raiz do repositório.
const envPaths = [
	path.resolve(repoRoot, ".env.local"),
	path.resolve(repoRoot, ".env"),
];

for (const envPath of envPaths) {
	loadDotEnv({ path: envPath, quiet: true });
}

/**
 * Schema de validação para variáveis de ambiente do NocoBase (scripts generator).
 */
export const env = createEnv({
	server: {
		NOCOBASE_API_URL: z
			.url("NOCOBASE_API_URL deve ser uma URL válida")
			.transform((url) => url.replace(/\/+$/, "")),
		NOCOBASE_API_KEY: z
			.string()
			.trim()
			.min(1, "NOCOBASE_API_KEY é obrigatório"),
		NOCOBASE_APP: z.string().trim().optional(),
		VITE_LOG_LEVEL: z.enum(["info", "debug"]).default("info"),
	},
	emptyStringAsUndefined: true,
	runtimeEnv: process.env,
	onValidationError: (issues) => {
		console.error(
			"Invalid environment variables:",
			JSON.stringify(issues, null, 2),
		);
		throw new Error("Invalid environment variables");
	},
});

interface ResolvedNocoBaseEnv {
	baseUrl: string;
	token: string;
	timeoutMs: number;
	logLevel: "error" | "warn" | "info" | "debug";
	requestHeaders?: Record<string, string>;
}

/**
 * Retorna as variáveis de ambiente já validadas e tipadas.
 */
export function resolveNocoBaseEnv(): ResolvedNocoBaseEnv {
	return {
		baseUrl: env.NOCOBASE_API_URL,
		token: env.NOCOBASE_API_KEY,
		timeoutMs: 15_000,
		logLevel: env.VITE_LOG_LEVEL,
		requestHeaders: env.NOCOBASE_APP
			? { "X-App": env.NOCOBASE_APP }
			: undefined,
	};
}
