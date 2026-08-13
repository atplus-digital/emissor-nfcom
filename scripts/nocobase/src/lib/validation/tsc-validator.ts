import { execFile } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { promisify } from "node:util";
import { createRequire } from "node:module";
import { writeCliErrorLines } from "@generators/lib/cli/cli-output";

const execFileAsync = promisify(execFile);

const CACHE_DIR = path.resolve(
	process.cwd(),
	".cache",
	"crm-atplus-tsc-validator",
);

export interface ValidateTypeScriptOptions {
	files?: string[];
}

const validationCache = new Map<string, Promise<boolean>>();

/**
 * Resolve o binário do `tsc` a partir do pacote `typescript` instalado.
 * O TypeScript 7 é um compilador nativo (Go) sem API JS — a validação
 * roda o CLI via child_process.
 */
function resolveTscBinary(): string {
	const require = createRequire(import.meta.url);
	const pkgPath = require.resolve("typescript/package.json");
	return path.join(path.dirname(pkgPath), "bin", "tsc");
}

function createCacheKey(files: string[]): string {
	return files
		.map((file) => path.resolve(process.cwd(), file))
		.sort()
		.join("|");
}

function getBuildInfoPath(cacheKey: string): string {
	fs.mkdirSync(CACHE_DIR, { recursive: true });
	const slug = cacheKey
		.replace(/[\\/]+/g, "_")
		.replace(/[^a-zA-Z0-9_.-]/g, "_")
		.slice(0, 120);
	return path.join(CACHE_DIR, `${slug}.tsbuildinfo`);
}

export function listTypeScriptFilesInDirectory(dirPath: string): string[] {
	const resolvedDir = path.resolve(process.cwd(), dirPath);
	if (!fs.existsSync(resolvedDir)) {
		return [];
	}

	const files: string[] = [];
	const entries = fs.readdirSync(resolvedDir, { withFileTypes: true });

	for (const entry of entries) {
		const fullPath = path.join(resolvedDir, entry.name);
		if (entry.isDirectory()) {
			files.push(...listTypeScriptFilesInDirectory(fullPath));
			continue;
		}

		if (entry.name.endsWith(".ts") || entry.name.endsWith(".d.ts")) {
			files.push(fullPath);
		}
	}

	return files;
}

function resolveExistingTypeScriptFiles(files: string[]): string[] {
	return Array.from(
		new Set(
			files
				.map((file) => path.resolve(process.cwd(), file))
				.filter(
					(file) =>
						fs.existsSync(file) &&
						(file.endsWith(".ts") || file.endsWith(".d.ts")),
				),
		),
	);
}

function runTypecheck(files: string[]): Promise<boolean> {
	const existingFiles = resolveExistingTypeScriptFiles(files);
	if (existingFiles.length === 0) {
		return Promise.resolve(true);
	}

	const cacheKey = createCacheKey(existingFiles);
	const args = [
		"--noEmit",
		// TS7 (compilador nativo) recusa arquivos na CLI quando há tsconfig
		// no diretório — `--ignoreConfig` pula essa checagem.
		"--ignoreConfig",
		"--incremental",
		`--tsBuildInfoFile`,
		getBuildInfoPath(cacheKey),
		...existingFiles,
	];

	return execFileAsync(resolveTscBinary(), args, {
		timeout: 60_000,
		maxBuffer: 10 * 1024 * 1024,
	})
		.then(() => true)
		.catch((error: unknown) => {
			const err = error as {
				code?: number;
				stdout?: string;
				stderr?: string;
			};
			// Exit code 1 = erros de tipo; outros códigos (2+) = falha de execução.
			if (err.code === 1) {
				const output = (err.stdout ?? err.stderr ?? "")
					.split("\n")
					.map((line) => line.trim())
					.filter((line) => line.length > 0);
				writeCliErrorLines(output);
				return false;
			}
			throw error;
		});
}

export async function validateTypeScriptFiles(
	files: string[],
): Promise<boolean> {
	const cacheKey = createCacheKey(files);
	const cached = validationCache.get(cacheKey);
	if (cached) {
		return cached;
	}

	const promise = runTypecheck(files);
	validationCache.set(cacheKey, promise);
	return promise;
}

export async function validateTypeScriptDirectory(
	dirPath: string,
	options?: ValidateTypeScriptOptions,
): Promise<boolean> {
	const resolvedDir = path.resolve(process.cwd(), dirPath);

	if (!fs.existsSync(resolvedDir)) {
		return true;
	}

	const files =
		options?.files && options.files.length > 0
			? options.files
			: listTypeScriptFilesInDirectory(resolvedDir);

	return validateTypeScriptFiles(files);
}

export function resetTypeScriptValidationCache(): void {
	validationCache.clear();
}
