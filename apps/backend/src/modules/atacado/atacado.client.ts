/**
 * Cliente HTTP do NocoBase (CRM Atacado) — ADR-0004.
 *
 * Convenções do NocoBase (ADR-0004):
 * - Ação como sufixo de rota: `<coleção>:get` / `:list` / `:create` / `:destroy`.
 * - Coleção é o nome da **tabela** (`t_*`), não o nome de rota amigável.
 * - Multi-app via header `X-App` (não na rota) — `NOCOBASE_APP`.
 * - `filterByTk` p/ lookup por id (PK); `filter` p/ filtros de campo.
 * - `appends` carrega relações na query.
 * - Destroy via POST `:destroy` (não DELETE HTTP).
 * - FKs enviadas duplicadas em creates aninhados (a coleção-alvo leva a FK).
 * - `list` faz paginação fake (`pageSize: 9999` — traz tudo); listagem
 *   paginada de verdade com total do filtro é `listPage` (page/pageSize +
 *   `meta.count` do envelope).
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
	page?: number;
}

/** Resultado de `listPage` — itens da página + total de registros do filtro. */
export interface ListPageResult {
	items: any[];
	/** Total de registros que casam com o filtro (todas as páginas). */
	total: number;
}

export interface AtacadoClient {
	get(colecao: string, query: ListQuery): Promise<any>;
	list(colecao: string, query: ListQuery): Promise<any[]>;
	/** Listagem paginada de verdade (`page` + `pageSize` reais, sem o 9999).
	 * `total` vem de `meta.count` do envelope NocoBase; sem `meta`, degrada p/
	 * o tamanho da página (o caller deve tratar total como mínimo). */
	listPage(colecao: string, query: ListQuery): Promise<ListPageResult>;
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

	const headers = (apiKey: string, app: string): Record<string, string> => ({
		"Content-Type": "application/json",
		Authorization: `Bearer ${apiKey}`,
		// Multi-app do NocoBase (ADR-0004): app vai como header X-App,
		// nunca na rota. Vazio → header omitido.
		...(app ? { "X-App": app } : {}),
	});

	const url = (
		base: string,
		colecao: string,
		acao: string,
		query?: Record<string, unknown>,
	) => {
		const u = new URL(`${base}/${colecao}:${acao}`);
		if (query) {
			for (const [k, v] of Object.entries(query)) {
				if (v === undefined) continue;
				// NocoBase: `filter` (objeto) vai como JSON; `appends` (array) vai
				// como CSV — JSON.stringify num array vira `["a","b"]`, que o
				// NocoBase interpreta como um único nome de associação e rejeita
				// com "association ... not found". Arrays → join(","); objetos →
				// JSON; primitivos → String (não envolve strings em aspas).
				u.searchParams.set(
					k,
					Array.isArray(v)
						? v.join(",")
						: typeof v === "object"
							? JSON.stringify(v)
							: String(v),
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

	/** Extrai o registro do envelope NocoBase `{ data: ... }` — mesma regra do
	 * `list` (pode vir envelope ou corpo direto em variações da API). */
	const unwrapData = (raw: any): any =>
		raw && typeof raw === "object" && !Array.isArray(raw) && "data" in raw
			? raw.data
			: raw;

	return {
		async get(colecao, query) {
			const { baseUrl, apiKey, app } = await resolveCreds();
			const raw = await requestJson(
				url(baseUrl, colecao, "get", query as Record<string, unknown>),
				{ method: "GET", headers: headers(apiKey, app) },
			);
			const data = unwrapData(raw);
			// NocoBase `:get` de id inexistente responde 200 com `{ data: null }`
			// (NÃO 404). Sem normalizar, o `null` vaza para o caller e o translator
			// estoura em `e.id`. Lança 404 — os callers de registro único já mapeiam
			// `AtacadoError(404)` → null.
			if (data === null || data === undefined) {
				throw new AtacadoError(
					`Atacado: registro não encontrado em ${colecao}`,
					404,
					JSON.stringify(raw) ?? "",
				);
			}
			return data;
		},
		async list(colecao, query) {
			const { baseUrl, apiKey, app } = await resolveCreds();
			const q = { pageSize: 9999, ...query } as Record<string, unknown>;
			const data: any = await requestJson(
				url(baseUrl, colecao, "list", q),
				{
					method: "GET",
					headers: headers(apiKey, app),
				},
			);
			// NocoBase: resposta pode vir como { data: [...] } ou array direto
			return Array.isArray(data) ? data : (data?.data ?? []);
		},
		async listPage(colecao, query) {
			const { baseUrl, apiKey, app } = await resolveCreds();
			// Sem o default pageSize: 9999 — paginação real (o caller manda
			// page/pageSize). `filter` segue como JSON, `appends` como CSV.
			const q = { page: 1, ...query } as Record<string, unknown>;
			const data: any = await requestJson(
				url(baseUrl, colecao, "list", q),
				{
					method: "GET",
					headers: headers(apiKey, app),
				},
			);
			// Envelope NocoBase: { data: [...], meta: { count, page, pageSize,
			// totalPage } } — `meta.count` é o total DO FILTRO (verificado na
			// instância). Sem `meta` (variações da API) degrada p/ tamanho da
			// página — total vira piso, não exato.
			const items: any[] = Array.isArray(data)
				? data
				: (data?.data ?? []);
			const total =
				typeof data?.meta?.count === "number"
					? data.meta.count
					: items.length;
			return { items, total };
		},
		async create(colecao, body) {
			const { baseUrl, apiKey, app } = await resolveCreds();
			const raw = await requestJson(url(baseUrl, colecao, "create"), {
				method: "POST",
				headers: headers(apiKey, app),
				body: JSON.stringify(body),
			});
			return unwrapData(raw);
		},
		async update(colecao, id, body) {
			const { baseUrl, apiKey, app } = await resolveCreds();
			const { res, text } = await httpFetch({
				url: url(baseUrl, colecao, "update", { filterByTk: id }),
				method: "POST",
				headers: headers(apiKey, app),
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
				url: url(baseUrl, colecao, "destroy", { filterByTk: id }),
				method: "POST",
				headers: headers(apiKey, app),
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
