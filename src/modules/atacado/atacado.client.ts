/**
 * Cliente HTTP do NocoBase (CRM Atacado) — ADR-0004.
 *
 * Convenções do NocoBase (ADR-0004):
 * - Ação como sufixo de rota: `<coleção>:get` / `:list` / `:create` / `:destroy`.
 * - `filterByTk` p/ lookup por id (PK); `filter` p/ filtros de campo.
 * - `appends` carrega relações na query.
 * - Destroy via POST `:destroy` (não DELETE HTTP).
 * - FKs enviadas duplicadas em creates aninhados (a coleção-alvo leva a FK).
 * - Paginação fake: `pageSize: 9999` p/ trazer tudo.
 *
 * O `fetch` é injetável p/ testes (mock). Em produção usa o global do Bun.
 */

import { httpFetch } from "#/lib/http";
import { log } from "#/lib/logger";

export type FetchLike = typeof fetch;

/** Cache do env lido de forma preguiçosa — só dispara validação quando o caller
 * não injeta baseUrl/apiKey/app (testes injetam, evitando o custo de env real).
 * Mesmo padrão do asaas.client (ADR-0004). */
let _envCache: { baseUrl: string; apiKey: string; app: string } | null = null;
async function envOrThrow(): Promise<{
	baseUrl: string;
	apiKey: string;
	app: string;
}> {
	if (_envCache) return _envCache;
	const { env } = await import("#/env");
	_envCache = {
		baseUrl: env.NOCOBASE_API_URL,
		apiKey: env.NOCOBASE_API_KEY,
		app: env.NOCOBASE_APP ?? "",
	};
	return _envCache;
}

export interface ListQuery {
	filterByTk?: number | string;
	filter?: Record<string, unknown>;
	appends?: string[];
	pageSize?: number;
}

export interface AtacadoClient {
	get(colecao: string, query: ListQuery): Promise<any>;
	list(colecao: string, query: ListQuery): Promise<any[]>;
	create(colecao: string, body: Record<string, unknown>): Promise<any>;
	update(
		colecao: string,
		id: number,
		body: Record<string, unknown>,
	): Promise<void>;
	destroy(colecao: string, id: number): Promise<void>;
}

export interface CreateAtacadoClientOpts {
	fetchImpl?: FetchLike;
	baseUrl?: string;
	apiKey?: string;
	app?: string;
}

/**
 * Factory do cliente NocoBase. Em produção lê `env.NOCOBASE_*` de forma
 * preguiçosa; em teste, injeta via `opts` (mesmo padrão do asaas.client).
 */
export function createAtacadoClient(
	opts: CreateAtacadoClientOpts = {},
): AtacadoClient {
	const fetchImpl = opts.fetchImpl ?? fetch;
	const resolveCreds = async () => {
		// Só dispara validação de env quando algum opt está ausente (testes
		// injetam tudo; produção deixa cair em envOrThrow). Mesmo padrão do asaas.
		if (opts.baseUrl && opts.apiKey && opts.app !== undefined) {
			return {
				baseUrl: opts.baseUrl.replace(/\/$/, ""),
				apiKey: opts.apiKey,
				app: opts.app,
			};
		}
		const e = await envOrThrow();
		return {
			baseUrl: (opts.baseUrl ?? e.baseUrl).replace(/\/$/, ""),
			apiKey: opts.apiKey ?? e.apiKey,
			app: opts.app ?? e.app,
		};
	};

	const headers = (apiKey: string): Record<string, string> => ({
		"Content-Type": "application/json",
		Authorization: `Bearer ${apiKey}`,
	});

	const url = (
		base: string,
		app: string,
		colecao: string,
		acao: string,
		query?: Record<string, unknown>,
	) => {
		const appPath = app ? `/${app}` : "";
		const u = new URL(`${base}${appPath}/api/${colecao}:${acao}`);
		if (query) {
			for (const [k, v] of Object.entries(query)) {
				if (v === undefined) continue;
				u.searchParams.set(
					k,
					typeof v === "object" ? JSON.stringify(v) : String(v),
				);
			}
		}
		return u.toString();
	};

	/** GET/JSON com o wrapper único httpFetch (timeout 30s — ADR-0005). Erro
	 * não-2xx → AtacadoError com o body como `detail`; 2xx com body vazio →
	 * undefined (caller trata; NocoBase sempre responde JSON em sucesso). */
	const requestJson = async (
		fullUrl: string,
		init: { method: string; headers: Record<string, string>; body?: string },
	): Promise<any> => {
		const { res, text } = await httpFetch({
			url: fullUrl,
			method: init.method,
			headers: init.headers,
			body: init.body,
			fetchImpl,
		});
		if (!res.ok) {
			throw new AtacadoError(`Atacado ${res.status}`, res.status, text);
		}
		return text ? JSON.parse(text) : undefined;
	};

	return {
		async get(colecao, query) {
			const { baseUrl, apiKey, app } = await resolveCreds();
			return requestJson(
				url(baseUrl, app, colecao, "get", query as Record<string, unknown>),
				{ method: "GET", headers: headers(apiKey) },
			);
		},
		async list(colecao, query) {
			const { baseUrl, apiKey, app } = await resolveCreds();
			const q = { pageSize: 9999, ...query } as Record<string, unknown>;
			const data: any = await requestJson(
				url(baseUrl, app, colecao, "list", q),
				{
					method: "GET",
					headers: headers(apiKey),
				},
			);
			// NocoBase: resposta pode vir como { data: [...] } ou array direto
			return Array.isArray(data) ? data : (data?.data ?? []);
		},
		async create(colecao, body) {
			const { baseUrl, apiKey, app } = await resolveCreds();
			return requestJson(url(baseUrl, app, colecao, "create"), {
				method: "POST",
				headers: headers(apiKey),
				body: JSON.stringify(body),
			});
		},
		async update(colecao, id, body) {
			const { baseUrl, apiKey, app } = await resolveCreds();
			const { res, text } = await httpFetch({
				url: url(baseUrl, app, colecao, "update", { filterByTk: id }),
				method: "POST",
				headers: headers(apiKey),
				body: JSON.stringify(body),
				fetchImpl,
			});
			if (!res.ok) {
				log.warn(
					{ status: res.status, colecao, id },
					"atacado: update não-2xx",
				);
				throw new AtacadoError(
					`Atacado update ${res.status}`,
					res.status,
					text,
				);
			}
		},
		async destroy(colecao, id) {
			const { baseUrl, apiKey, app } = await resolveCreds();
			const { res, text } = await httpFetch({
				url: url(baseUrl, app, colecao, "destroy", { filterByTk: id }),
				method: "POST",
				headers: headers(apiKey),
				fetchImpl,
			});
			if (!res.ok) {
				log.warn(
					{ status: res.status, colecao, id },
					"atacado: destroy não-2xx",
				);
				throw new AtacadoError(
					`Atacado destroy ${res.status}`,
					res.status,
					text,
				);
			}
		},
	};
}

/** Erro tipado do Atacado. `isRetryable()` classifica para o worker decidir
 * retry (5xx/408/429/rede) vs fatal (4xx negócio) — ADR-0004. */
export class AtacadoError extends Error {
	constructor(
		message: string,
		readonly statusCode: number,
		readonly detail: string,
	) {
		super(message);
		this.name = "AtacadoError";
	}

	/** 5xx/408/429 → retryable; 4xx → fatal. */
	isRetryable(): boolean {
		return (
			this.statusCode >= 500 ||
			this.statusCode === 408 ||
			this.statusCode === 429
		);
	}
}
