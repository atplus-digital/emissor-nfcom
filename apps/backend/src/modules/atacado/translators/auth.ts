/**
 * Cliente de autenticação do NocoBase (CRM Atacado) — ADR-0004.
 *
 * Não herda do `AtacadoClient` (que é de coleções `t_*`): a auth fala com a
 * rota especial `auth:signIn` / `auth:check` do NocoBase, com o
 * `X-Authenticator` (id do autenticador configurado no NocoBase — default
 * "password"). Multi-app via header `X-App` (mesmo `NOCOBASE_APP` das
 * coleções).
 *
 * Env lido de forma preguiçosa (cache) — mesmo padrão do `atacado.client`:
 * testes injetam `baseUrl`/`app`/`authenticator` e não disparam validação de
 * env real. `NOCOBASE_API_URL` já inclui `/api` (o composition root liga).
 */
import { httpFetch } from "#/lib/http";
import type { FetchLike } from "../atacado.client";

/** Sessão NocoBase obtida no `signIn` — o token vai no cookie do painel. */
export interface SessaoNocoBase {
	token: string;
	userId?: number;
	nickname?: string;
	email?: string;
}

export interface AuthNocoBaseClient {
	/**
	 * Autentica com `account`/`password`. Credencial inválida →
	 * `AuthNocoBaseError(401)`; outros não-2xx → `AuthNocoBaseError(status)`.
	 */
	signIn(account: string, password: string): Promise<SessaoNocoBase>;
	/** `true` se a sessão (Bearer token) ainda é válida no NocoBase. */
	check(token: string): Promise<boolean>;
}

export interface CreateAuthNocoBaseClientOpts {
	fetchImpl?: FetchLike;
	baseUrl?: string;
	/** apiKey omitido de propósito: a auth usa `X-Authenticator`, não Bearer. */
	apiKey?: string;
	app?: string;
	/** Id do autenticador do NocoBase (header `X-Authenticator`). */
	authenticator?: string;
}

/** Erro tipado da auth NocoBase — `statusCode` carrega o status do NocoBase. */
export class AuthNocoBaseError extends Error {
	constructor(
		message: string,
		readonly statusCode: number,
	) {
		super(message);
		this.name = "AuthNocoBaseError";
	}
}

/** Cache do env lido de forma preguiçosa (mesmo padrão do atacado.client). */
let _envCache: { baseUrl: string; app: string; authenticator: string } | null =
	null;
async function envOrThrow(): Promise<{
	baseUrl: string;
	app: string;
	authenticator: string;
}> {
	if (_envCache) return _envCache;
	const { env } = await import("#/env");
	_envCache = {
		baseUrl: env.NOCOBASE_API_URL,
		app: env.NOCOBASE_APP ?? "",
		authenticator: env.NOCOBASE_AUTHENTICATOR,
	};
	return _envCache;
}

/**
 * Factory do cliente de auth. Em produção lê `env.NOCOBASE_*` de forma
 * preguiçosa; em teste, injeta via `opts`.
 */
export function createAuthNocoBaseClient(
	opts: CreateAuthNocoBaseClientOpts = {},
): AuthNocoBaseClient {
	const fetchImpl = opts.fetchImpl ?? fetch;
	const resolveCreds = async () => {
		if (opts.baseUrl && opts.app !== undefined && opts.authenticator !== undefined) {
			return {
				baseUrl: opts.baseUrl.replace(/\/$/, ""),
				app: opts.app,
				authenticator: opts.authenticator,
			};
		}
		const e = await envOrThrow();
		return {
			baseUrl: (opts.baseUrl ?? e.baseUrl).replace(/\/$/, ""),
			app: opts.app ?? e.app,
			authenticator: opts.authenticator ?? e.authenticator,
		};
	};

	const headers = (
		app: string,
		authenticator: string,
		extra: Record<string, string> = {},
	): Record<string, string> => ({
		"Content-Type": "application/json",
		"X-Authenticator": authenticator,
		// Multi-app (ADR-0004): X-App só quando não vazio.
		...(app ? { "X-App": app } : {}),
		...extra,
	});

	/** Extrai o user da resposta — cobre `{ data }` e `{ data: { data } }`. */
	const unwrapUser = (raw: any): any => {
		if (!raw || typeof raw !== "object") return undefined;
		return raw.data ?? undefined;
	};

	return {
		async signIn(account, password) {
			const { baseUrl, app, authenticator } = await resolveCreds();
			const { res, text } = await httpFetch({
				url: `${baseUrl}/auth:signIn`,
				method: "POST",
				headers: headers(app, authenticator),
				body: JSON.stringify({ account, password }),
				fetchImpl,
			});
			if (!res.ok) {
				// 401 = credencial inválida (o painel vira 401 NAO_AUTORIZADO).
				// Outros não-2xx (5xx etc.) → erro com o status do NocoBase.
				throw new AuthNocoBaseError(
					`auth NocoBase signIn ${res.status}`,
					res.status,
				);
			}
			let data: any;
			try {
				data = text ? JSON.parse(text) : undefined;
			} catch {
				throw new AuthNocoBaseError("auth NocoBase: resposta inválida", res.status);
			}
			// NocoBase responde `{ data: { token, id, nickname, email } }`; em
			// variações o user pode vir aninhado (`data.data.token`) — cobre ambos.
			const user = unwrapUser(data);
			const token: string | undefined =
				user?.token ?? (data?.data && data.data.token);
			if (!token) {
				throw new AuthNocoBaseError("auth NocoBase: sem token na resposta", res.status);
			}
			return {
				token,
				userId: user?.id != null ? Number(user.id) : undefined,
				nickname: user?.nickname,
				email: user?.email,
			};
		},
		async check(token) {
			const { baseUrl, app, authenticator } = await resolveCreds();
			const { res } = await httpFetch({
				url: `${baseUrl}/auth:check`,
				method: "POST",
				headers: headers(app, authenticator, {
					Authorization: `Bearer ${token}`,
				}),
				fetchImpl,
			});
			return res.ok;
		},
	};
}
