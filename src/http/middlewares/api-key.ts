/**
 * src/http/middlewares/api-key.ts — autorização por API key (CONVENTIONS · Autorização).
 *
 * A API do emissor é interna (chamada por sistemas do AT+). Autenticação por header
 * `X-API-Key` contra `EMISSOR_API_KEY`. Sem key/errada → `401` envelope NAO_AUTORIZADO.
 *
 * `apiKeyMiddleware(key)` recebe a key injetada (testes passam direto; o composition
 * root lê `env.EMISSOR_API_KEY` e injeta — não importa `#/env` aqui, evitando disparar
 * validação de env em testes).
 */
import type { MiddlewareHandler } from "hono";
import { erroResponse, TipoErro } from "#/http/middlewares/envelope";

/** Middleware que valida o header `X-API-Key` contra a key informada. */
export function apiKeyMiddleware(expectedKey: string): MiddlewareHandler {
	return async (c, next) => {
		const provided = c.req.header("X-API-Key");
		if (!provided || provided !== expectedKey) {
			const { corpo, status } = erroResponse(
				TipoErro.NAO_AUTORIZADO,
				"API key ausente ou inválida (header X-API-Key)",
			);
			return c.json(corpo, status as 200);
		}
		await next();
	};
}

/**
 * Factory para o composition root: lê `env.EMISSOR_API_KEY` e devolve o middleware.
 * Importa `#/env` lazily para não acoplar o módulo à validação de env.
 */
export async function criarApiKeyMiddleware(): Promise<MiddlewareHandler> {
	const { env } = await import("#/env");
	return apiKeyMiddleware(env.EMISSOR_API_KEY);
}
