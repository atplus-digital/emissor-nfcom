/**
 * src/lib/http.ts — wrapper único de HTTP (ADR-0005).
 *
 * O ADR-0005 decidiu "fetch nativo + wrapper próprio": um wrapper leve aqui em
 * `src/lib/http` padroniza timeout (`AbortController`), retry e classificação de
 * erro num único estilo — sem axios. Este módulo cobre o **timeout** e a leitura
 * do body; a classificação de erro (AsaasApiError/AtacadoError/NfcomApiError)
 * permanece no caller, que conhece o envelope de cada provedor (Asaas/NFCom/
 * Atacado têm envelopes diferentes).
 *
 * - `httpFetch` dispara `AbortController` via `setTimeout` em `timeoutMs`
 *   (default 30s) e **sempre limpa o timer** (finally), mesmo em sucesso/erro.
 * - Timeout → lança `HttpTimeoutError` (o worker classifica como retryable).
 *   Erro de rede (ECONNREFUSED, DNS...) → repassa o erro original para o caller
 *   classificar (ex.: `AtacadoError.isRetryable()` não se aplica a rede; o worker
 *   trata rede como retryable).
 * - Retorna `{ res, text }`: o caller faz o `JSON.parse` conforme o seu contrato
 *   (envelopes Asaas/NFCom/Atacado diferentes).
 *
 * `fetchImpl` é injetável p/ testes (default: fetch global do Bun).
 */
import { log } from "#/lib/logger";

/** Erro tipado de timeout (AbortController) — distinto de erro de rede. */
export class HttpTimeoutError extends Error {
	constructor(
		readonly timeoutMs: number,
		readonly url: string,
	) {
		super(`HTTP timeout após ${timeoutMs}ms: ${url}`);
		this.name = "HttpTimeoutError";
	}
}

export interface HttpFetchOptions {
	url: string;
	method?: string;
	headers?: Record<string, string>;
	body?: string;
	/** Timeout em ms (default 30000). */
	timeoutMs?: number;
	/** fetch injetável p/ testes (default: fetch global do Bun). */
	fetchImpl?: typeof fetch;
}

export interface HttpFetchResult {
	res: Response;
	/** Body da resposta como string (caller faz o parse conforme o envelope). */
	text: string;
}

/**
 * Executa `fetch` com timeout via `AbortController`. Devolve `{ res, text }`;
 * lança `HttpTimeoutError` em timeout ou repassa o erro de rede. O timer é
 * sempre limpo no `finally` — um fetch que resolve antes do timeout não vaza
 * timer nem aborta depois do sucesso.
 */
export async function httpFetch(
	opts: HttpFetchOptions,
): Promise<HttpFetchResult> {
	const {
		url,
		method = "GET",
		headers,
		body,
		timeoutMs = 30000,
		fetchImpl = fetch,
	} = opts;

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const res = await fetchImpl(url, {
			method,
			headers,
			body,
			signal: controller.signal,
		});
		const text = await res.text();
		return { res, text };
	} catch (err) {
		if (err instanceof Error && err.name === "AbortError") {
			log.warn({ timeoutMs, url }, "http: timeout (AbortController)");
			throw new HttpTimeoutError(timeoutMs, url);
		}
		throw err;
	} finally {
		clearTimeout(timer);
	}
}
