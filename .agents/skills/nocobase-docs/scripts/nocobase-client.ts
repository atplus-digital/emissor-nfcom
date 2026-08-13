/**
 * NocoBase Read-Only Client
 *
 * Strictly read-only TypeScript client for NocoBase API exploration.
 * All requests are logged to stderr (structured JSON) for auditability.
 *
 * Usage:
 *   npx tsx .agents/skills/nocobase-docs/scripts/nocobase-client.ts <command> [args...]
 *
 * Commands:
 *   swagger [--ns=<namespace>]       Fetch swagger/OpenAPI spec (GET)
 *   collections [--name=<name>]      List collections or get one by name (GET)
 *   list <collection> [params...]    List records — GET /{collection}:list
 *   count <collection>              Count records — GET /{collection}:count
 *   get <collection> <id>           Get record by ID — POST /{collection}:get
 *   raw <endpoint>                  Raw request to any read-only endpoint
 *   help                            Show this help
 *
 * Examples:
 *   npx tsx .agents/skills/nocobase-docs/scripts/nocobase-client.ts swagger
 *   npx tsx .agents/skills/nocobase-docs/scripts/nocobase-client.ts swagger --ns=collections
 *   npx tsx .agents/skills/nocobase-docs/scripts/nocobase-client.ts collections
 *   npx tsx .agents/skills/nocobase-docs/scripts/nocobase-client.ts collections --name=t_pessoas
 *   npx tsx .agents/skills/nocobase-docs/scripts/nocobase-client.ts list t_pessoas --page=1 --pageSize=20
 *   npx tsx .agents/skills/nocobase-docs/scripts/nocobase-client.ts get t_pessoas 42
 *   npx tsx .agents/skills/nocobase-docs/scripts/nocobase-client.ts raw "swagger:get?ns=collections/t_pessoas"
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath, URLSearchParams } from "node:url";

// ---------------------------------------------------------------------------
// Environment configuration
// ---------------------------------------------------------------------------

interface EnvConfig {
	baseUrl: string;
	token: string;
	timeoutMs: number;
}

function loadEnv(): EnvConfig {
	const scriptDir = path.dirname(fileURLToPath(import.meta.url));
	const skillDir = path.resolve(scriptDir, "..");
	const envPath = path.join(skillDir, ".env.local");

	if (fs.existsSync(envPath)) {
		const content = fs.readFileSync(envPath, "utf-8");
		for (const line of content.split("\n")) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith("#")) continue;
			const eqIdx = trimmed.indexOf("=");
			if (eqIdx === -1) continue;
			const key = trimmed.slice(0, eqIdx).trim();
			const val = trimmed
				.slice(eqIdx + 1)
				.trim()
				.replace(/^["']|["']$/g, "");
			if (!process.env[key]) {
				process.env[key] = val;
			}
		}
	}

	const baseUrl = process.env.CRM_NOCOBASE_URL;
	const token = process.env.CRM_NOCOBASE_TOKEN;
	const timeoutMs = Number(process.env.CRM_NOCOBASE_TIMEOUT_MS) || 15_000;

	if (!baseUrl || !token) {
		const missing: string[] = [];
		if (!baseUrl) missing.push("CRM_NOCOBASE_URL");
		if (!token) missing.push("CRM_NOCOBASE_TOKEN");

		console.error(
			`CREDENTIALS_REQUIRED:${JSON.stringify(missing)}\n` +
				`Missing required credentials: ${missing.join(", ")}.\n` +
				`The file ${envPath} does not exist or is incomplete.\n` +
				`Ask the user for their NocoBase credentials and create ${envPath} with:\n` +
				`  CRM_NOCOBASE_URL=https://your-instance.com/api\n` +
				`  CRM_NOCOBASE_TOKEN=your-api-token\n` +
				`  CRM_NOCOBASE_TIMEOUT_MS=15000`,
		);
		process.exit(1);
	}

	return { baseUrl: baseUrl.replace(/\/+$/, ""), token, timeoutMs };
}

// ---------------------------------------------------------------------------
// Read-only endpoint validation
// ---------------------------------------------------------------------------

/**
 * NocoBase API endpoints follow the pattern: /{resource}:{action}
 * Only these actions are permitted — all are read-only data retrieval operations.
 * Per the official NocoBase OpenAPI spec (swagger:index.json), the core
 * actions are :list (GET) and :get (POST with filterByTk in body).
 */
const READONLY_ACTIONS = new Set(["list", "get", "count"]);

const READONLY_SPECIAL_ENDPOINTS = new Set([
	"swagger:get",
	"collections:list",
	"collections:get",
]);

function isReadonlyEndpoint(endpoint: string): boolean {
	if (READONLY_SPECIAL_ENDPOINTS.has(endpoint)) return true;

	const colonIdx = endpoint.lastIndexOf(":");
	if (colonIdx === -1) return false;

	const action = endpoint.slice(colonIdx + 1).split("?")[0];
	return READONLY_ACTIONS.has(action);
}

/**
 * NocoBase uses GET for :list but POST for :get (with filterByTk in body),
 * as documented in the official REST API Data Source spec.
 */
function getHttpMethod(endpoint: string): "GET" | "POST" {
	const colonIdx = endpoint.lastIndexOf(":");
	if (colonIdx === -1) return "GET";
	const action = endpoint.slice(colonIdx + 1).split("?")[0];
	return action === "get" ? "POST" : "GET";
}

// ---------------------------------------------------------------------------
// Request logger
// ---------------------------------------------------------------------------

interface RequestLog {
	timestamp: string;
	method: string;
	endpoint: string;
	fullUrl: string;
	status: "pending" | "success" | "error";
	statusCode?: number;
	durationMs?: number;
	errorMessage?: string;
	requestBody?: Record<string, unknown>;
}

function createLogEntry(
	method: string,
	endpoint: string,
	fullUrl: string,
	body?: Record<string, unknown>,
): RequestLog {
	return {
		timestamp: new Date().toISOString(),
		method,
		endpoint,
		fullUrl,
		status: "pending",
		requestBody: body,
	};
}

function getLogFilePath(): string {
	const scriptDir = path.dirname(fileURLToPath(import.meta.url));
	const skillDir = path.resolve(scriptDir, "..");
	return path.join(skillDir, "nocobase-client.log");
}

function appendLogFile(log: RequestLog): void {
	const logLine = JSON.stringify(log);
	try {
		fs.appendFileSync(getLogFilePath(), `${logLine}\n`, "utf-8");
	} catch {
		// Silently fail — file logging is best-effort and must never break the client
	}
}

function logRequest(log: RequestLog): void {
	const logLine = JSON.stringify(log);
	process.stderr.write(`${logLine}\n`);

	const status =
		log.status === "success"
			? `${log.statusCode}`
			: log.status === "error"
				? `ERR${log.statusCode ? ` ${log.statusCode}` : ""}`
				: "PENDING";
	const duration = log.durationMs ? ` (${log.durationMs}ms)` : "";
	const bodyHint = log.requestBody
		? ` body=${JSON.stringify(log.requestBody)}`
		: "";
	console.error(
		`[NocoBase] ${log.timestamp} ${log.method} ${log.endpoint} → ${status}${duration}${bodyHint}`,
	);
	appendLogFile(log);
}

// ---------------------------------------------------------------------------
// HTTP client (read-only, with logging)
// ---------------------------------------------------------------------------

async function fetchReadOnly(
	config: EnvConfig,
	endpoint: string,
	queryParams?: Record<string, string>,
	bodyParams?: Record<string, unknown>,
): Promise<unknown> {
	if (!isReadonlyEndpoint(endpoint)) {
		const error = `BLOCKED: Endpoint "${endpoint}" is not read-only. Only :list, :get, swagger:get, collections:list, and collections:get are permitted.`;
		console.error(`[NocoBase SECURITY] ${error}`);
		throw new Error(error);
	}

	const method = getHttpMethod(endpoint);
	const separator = endpoint.includes("?") ? "&" : "?";
	const queryString = queryParams
		? `${separator}${new URLSearchParams(queryParams).toString()}`
		: "";
	const fullUrl = `${config.baseUrl}/${endpoint}${queryString}`;

	const log = createLogEntry(method, endpoint, fullUrl, bodyParams);
	logRequest(log);

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
	const startTime = Date.now();

	const fetchOptions: RequestInit = {
		method,
		headers: {
			Authorization: `Bearer ${config.token}`,
			Accept: "application/json",
			...(method === "POST" ? { "Content-Type": "application/json" } : {}),
		},
		signal: controller.signal,
	};

	if (method === "POST" && bodyParams) {
		fetchOptions.body = JSON.stringify(bodyParams);
	}

	try {
		const response = await fetch(fullUrl, fetchOptions);

		log.durationMs = Date.now() - startTime;
		log.statusCode = response.status;

		if (!response.ok) {
			const body = await response.text().catch(() => "");
			log.status = "error";
			log.errorMessage = `HTTP ${response.status} ${response.statusText}`;
			logRequest(log);
			throw new Error(
				`HTTP ${response.status} ${response.statusText} on ${fullUrl}${body ? ` — ${body.slice(0, 200)}` : ""}`,
			);
		}

		const data = await response.json();
		log.status = "success";
		logRequest(log);
		return data;
	} catch (error) {
		log.durationMs = Date.now() - startTime;
		log.status = "error";

		if (error instanceof DOMException && error.name === "AbortError") {
			log.errorMessage = `Timeout after ${config.timeoutMs}ms`;
			logRequest(log);
			throw new Error(
				`Request to ${fullUrl} timed out after ${config.timeoutMs}ms`,
			);
		}

		log.errorMessage = error instanceof Error ? error.message : String(error);
		logRequest(log);
		throw error;
	} finally {
		clearTimeout(timeout);
	}
}

// ---------------------------------------------------------------------------
// Command handlers
// ---------------------------------------------------------------------------

async function cmdSwagger(config: EnvConfig, args: string[]): Promise<void> {
	const nsArg = args.find((a) => a.startsWith("--ns="));
	const queryParams: Record<string, string> = {};
	if (nsArg) {
		queryParams.ns = nsArg.slice(5);
	}

	const endpoint = queryParams.ns
		? `swagger:get?ns=${encodeURIComponent(queryParams.ns)}`
		: "swagger:get";

	const data = await fetchReadOnly(config, endpoint);
	console.log(JSON.stringify(data, null, 2));
}

async function cmdCollections(
	config: EnvConfig,
	args: string[],
): Promise<void> {
	const nameArg = args.find((a) => a.startsWith("--name="));

	if (nameArg) {
		const name = nameArg.slice(7);
		const data = await fetchReadOnly(config, "collections:get", undefined, {
			filterByTk: name,
			appends: ["fields"],
		});
		console.log(JSON.stringify(data, null, 2));
	} else {
		const data = await fetchReadOnly(config, "collections:list", {
			paginate: "false",
		});
		console.log(JSON.stringify(data, null, 2));
	}
}

async function cmdList(
	config: EnvConfig,
	collection: string,
	args: string[],
): Promise<void> {
	const queryParams: Record<string, string> = {};

	for (const arg of args) {
		if (arg.startsWith("--page=")) queryParams.page = arg.slice(7);
		else if (arg.startsWith("--pageSize="))
			queryParams.pageSize = arg.slice(11);
		else if (arg.startsWith("--sort=")) queryParams.sort = arg.slice(7);
		else if (arg.startsWith("--fields=")) queryParams.fields = arg.slice(9);
		else if (arg.startsWith("--appends=")) queryParams.appends = arg.slice(10);
		else if (arg.startsWith("--filter=")) queryParams.filter = arg.slice(9);
		else if (arg.startsWith("--except=")) queryParams.except = arg.slice(9);
	}

	const data = await fetchReadOnly(config, `${collection}:list`, queryParams);
	console.log(JSON.stringify(data, null, 2));
}

async function cmdGet(
	config: EnvConfig,
	collection: string,
	id: string,
	args: string[],
): Promise<void> {
	const body: Record<string, unknown> = { filterByTk: id };

	for (const arg of args) {
		if (arg.startsWith("--fields=")) body.fields = arg.slice(9).split(",");
		else if (arg.startsWith("--appends="))
			body.appends = arg.slice(10).split(",");
		else if (arg.startsWith("--except=")) body.except = arg.slice(9).split(",");
	}

	const data = await fetchReadOnly(
		config,
		`${collection}:get`,
		undefined,
		body,
	);
	console.log(JSON.stringify(data, null, 2));
}

async function cmdCount(
	config: EnvConfig,
	collection: string,
	args: string[],
): Promise<void> {
	const queryParams: Record<string, string> = {};

	for (const arg of args) {
		if (arg.startsWith("--filter=")) queryParams.filter = arg.slice(9);
	}

	const data = await fetchReadOnly(config, `${collection}:count`, queryParams);
	console.log(JSON.stringify(data, null, 2));
}

async function cmdRaw(config: EnvConfig, endpoint: string): Promise<void> {
	const data = await fetchReadOnly(config, endpoint);
	console.log(JSON.stringify(data, null, 2));
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

function printHelp(): void {
	console.log(`
NocoBase Read-Only Client
=========================

A strictly read-only client for exploring NocoBase APIs.
All requests are logged (structured JSON to stderr) for auditability.

Usage:
  npx tsx .agents/skills/nocobase-docs/scripts/nocobase-client.ts <command> [args...]

Commands:
  swagger [--ns=<namespace>]        Fetch swagger/OpenAPI spec (GET)
  collections [--name=<name>]       List collections or get one by name
  list <collection> [options]       List records (GET /{collection}:list)
  get <collection> <id> [options]   Get record by ID (POST /{collection}:get)
  count <collection> [options]      Count records (GET /{collection}:count)
  raw <endpoint>                    Raw request to any read-only endpoint
  help                              Show this help

Options for list:
  --page=N          Page number (default: 1)
  --pageSize=N      Items per page
  --sort=<field>    Sort field (prefix with - for desc)
  --fields=<list>   Fields to return (comma-separated)
  --appends=<list>  Relations to include (comma-separated)
  --except=<list>   Fields to exclude (comma-separated)
  --filter=<json>   Filter object (JSON string)

Options for get:
  --fields=<list>   Fields to return (comma-separated)
  --appends=<list>  Relations to include (comma-separated)
  --except=<list>   Fields to exclude (comma-separated)

Examples:
  nocobase-client.ts swagger
  nocobase-client.ts swagger --ns=collections/t_pessoas
  nocobase-client.ts collections
  nocobase-client.ts collections --name=t_pessoas
  nocobase-client.ts list t_pessoas --page=1 --pageSize=20
  nocobase-client.ts get t_pessoas 42 --appends=createdBy
  nocobase-client.ts raw "swagger:get?ns=collections"
`);
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);

	if (args.length === 0 || args[0] === "help" || args[0] === "--help") {
		printHelp();
		process.exit(0);
	}

	const config = loadEnv();
	const command = args[0];
	const rest = args.slice(1);

	switch (command) {
		case "swagger":
			await cmdSwagger(config, rest);
			break;
		case "collections":
			await cmdCollections(config, rest);
			break;
		case "list": {
			const collection = rest[0];
			if (!collection) {
				console.error("ERROR: 'list' requires a collection name.");
				console.error("Usage: nocobase-client.ts list <collection> [options]");
				process.exit(1);
			}
			await cmdList(config, collection, rest.slice(1));
			break;
		}
		case "get": {
			const collection = rest[0];
			const id = rest[1];
			if (!collection || !id) {
				console.error("ERROR: 'get' requires collection name and record ID.");
				console.error(
					"Usage: nocobase-client.ts get <collection> <id> [options]",
				);
				process.exit(1);
			}
			await cmdGet(config, collection, id, rest.slice(2));
			break;
		}
		case "count": {
			const collection = rest[0];
			if (!collection) {
				console.error("ERROR: 'count' requires a collection name.");
				console.error(
					"Usage: nocobase-client.ts count <collection> [--filter=<json>]",
				);
				process.exit(1);
			}
			await cmdCount(config, collection, rest.slice(1));
			break;
		}
		case "raw": {
			const endpoint = rest[0];
			if (!endpoint) {
				console.error("ERROR: 'raw' requires an endpoint.");
				console.error("Usage: nocobase-client.ts raw <endpoint>");
				process.exit(1);
			}
			await cmdRaw(config, endpoint);
			break;
		}
		default:
			console.error(`ERROR: Unknown command "${command}".`);
			printHelp();
			process.exit(1);
	}
}

main().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});
