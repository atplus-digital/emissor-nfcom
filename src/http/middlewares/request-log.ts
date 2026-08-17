/**
 * src/http/middlewares/request-log.ts — contexto de correlação por request (ADR-0008).
 *
 * Popula o ALS (`runWithLogContext`) com `metodo` + `rota` para que qualquer log
 * downstream (rotas, handlers, domínio) carregue a correlação sem parâmetro explícito.
 * Não loga o corpo (redação pino já protege; corpos externos não são logados crus).
 */
import type { MiddlewareHandler } from "hono";
import { runWithLogContext } from "#/lib/logger";

/** Middleware que envolve a request num store ALS com metodo + rota. */
export function requestLogMiddleware(): MiddlewareHandler {
	return async (c, next) => {
		return runWithLogContext({ metodo: c.req.method, rota: c.req.path }, async () => {
			await next();
		});
	};
}
