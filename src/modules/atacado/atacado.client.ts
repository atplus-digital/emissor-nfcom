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
import { env } from "#/env";

export type FetchLike = typeof fetch;

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
	update(colecao: string, id: number, body: Record<string, unknown>): Promise<void>;
	destroy(colecao: string, id: number): Promise<void>;
}

export function createAtacadoClient(fetchFn: FetchLike = fetch): AtacadoClient {
	const base = env.NOCOBASE_API_URL.replace(/\/$/, "");
	const app = env.NOCOBASE_APP ? `/${env.NOCOBASE_APP}` : "";
	const headers = (): Record<string, string> => ({
		"Content-Type": "application/json",
		Authorization: `Bearer ${env.NOCOBASE_API_KEY}`,
	});

	const url = (colecao: string, acao: string, query?: Record<string, unknown>) => {
		const u = new URL(`${base}${app}/api/${colecao}:${acao}`);
		if (query) {
			for (const [k, v] of Object.entries(query)) {
				if (v === undefined) continue;
				u.searchParams.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
			}
		}
		return u.toString();
	};

	const json = async (res: Response) => {
		if (!res.ok) {
			throw new AtacadoError(`Atacado ${res.status}`, res.status, await res.text());
		}
		return res.json();
	};

	return {
		async get(colecao, query) {
			const res = await fetchFn(url(colecao, "get", query as Record<string, unknown>), {
				method: "GET",
				headers: headers(),
			});
			return json(res);
		},
		async list(colecao, query) {
			const q = { pageSize: 9999, ...query } as Record<string, unknown>;
			const res = await fetchFn(url(colecao, "list", q), { method: "GET", headers: headers() });
			const data: any = await json(res);
			// NocoBase: resposta pode vir como { data: [...] } ou array direto
			return Array.isArray(data) ? data : (data?.data ?? []);
		},
		async create(colecao, body) {
			const res = await fetchFn(url(colecao, "create"), {
				method: "POST",
				headers: headers(),
				body: JSON.stringify(body),
			});
			return json(res);
		},
		async update(colecao, id, body) {
			const res = await fetchFn(url(colecao, "update", { filterByTk: id }), {
				method: "POST",
				headers: headers(),
				body: JSON.stringify(body),
			});
			if (!res.ok) throw new AtacadoError(`Atacado update ${res.status}`, res.status, await res.text());
		},
		async destroy(colecao, id) {
			const res = await fetchFn(url(colecao, "destroy", { filterByTk: id }), {
				method: "POST",
				headers: headers(),
			});
			if (!res.ok) throw new AtacadoError(`Atacado destroy ${res.status}`, res.status, await res.text());
		},
	};
}

export class AtacadoError extends Error {
	constructor(
		message: string,
		readonly statusCode: number,
		readonly detail: string,
	) {
		super(message);
		this.name = "AtacadoError";
	}
}
