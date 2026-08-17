/**
 * Cliente HTTP do gateway NFCom (ADR-0001).
 *
 * Contrato verificado no swagger (api.nfcom.com.br, Vigo, OpenAPI 3.0.4):
 * - `POST /api/auth` {login, senha} → {token} (bearer, TTL 12h).
 * - `POST /api/emitir` ApiNFComEmitir (additionalProperties: false) → NFCom.
 * - `GET /api/lista` por cpfcnpj+janela → lista com chave/situacao/protocolo.
 *
 * O cliente é injetável (testes passam um fake); a URL/credenciais vêm de
 * `env` (NFCOM_API_URL/LOGIN/SENHA). Lança `NfcomApiError` em non-2xx,
 * expondo `status` p/ o repository decidir reauth (401).
 */
import { env } from "#/env";
import type { ApiNFComEmitir, NFComResposta } from "./translators/emitir";

export interface NfcomApiError extends Error {
	status: number;
}

export interface NFComListaItemResposta {
	chave: string;
	situacao: string;
	protocolo: string;
}

export interface NfcomClient {
	auth(login: string, senha: string): Promise<{ token: string }>;
	emitir(token: string, payload: ApiNFComEmitir): Promise<NFComResposta>;
	consultaLista(
		token: string,
		cpfcnpj: string,
		dataInicio: string,
		dataFim: string,
	): Promise<NFComListaItemResposta[]>;
}

function makeError(status: number, body: unknown): NfcomApiError {
	const e = new Error(
		`NFCom HTTP ${status}: ${typeof body === "string" ? body : JSON.stringify(body)}`,
	) as NfcomApiError;
	e.name = "NfcomApiError";
	e.status = status;
	return e;
}

/** Cria o cliente HTTP real do gateway NFCom (fetch-based). */
export function criarNfcomClient(baseUrl: string = env.NFCOM_API_URL): NfcomClient {
	async function request<T>(
		path: string,
		options: { method: string; token?: string; body?: unknown },
	): Promise<T> {
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};
		if (options.token) headers.Authorization = `Bearer ${options.token}`;
		const res = await fetch(`${baseUrl}${path}`, {
			method: options.method,
			headers,
			body: options.body ? JSON.stringify(options.body) : undefined,
		});
		const text = await res.text();
		if (!res.ok) throw makeError(res.status, text);
		return (text ? JSON.parse(text) : undefined) as T;
	}

	return {
		async auth(login, senha) {
			return request<{ token: string }>("/api/auth", {
				method: "POST",
				body: { login, senha },
			});
		},
		async emitir(token, payload) {
			return request<NFComResposta>("/api/emitir", {
				method: "POST",
				token,
				body: payload,
			});
		},
		async consultaLista(token, cpfcnpj, dataInicio, dataFim) {
			const qs = new URLSearchParams({
				cpfcnpj,
				dataInicio,
				dataFim,
			});
			return request<NFComListaItemResposta[]>(
				`/api/lista?${qs.toString()}`,
				{ method: "GET", token },
			);
		},
	};
}
