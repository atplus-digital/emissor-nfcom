/**
 * src/http/middlewares/error-handler.ts — handler canônico de erro (CONVENTIONS · Envelope).
 *
 * Traduz erros lançados nas rotas para o envelope `{ erro: { tipo, mensagem, detalhe } }`:
 * - `HttpError` → usa seus campos (tipo/status/mensagem/detalhe).
 * - `ZodError` (validação de rota) → 422 VALIDACAO com `detalhe.campos`.
 * - outro `Error` → 500 ERRO_INTERNO, mensagem genérica (não vaza stack/detalhe).
 *
 * Regra ADR-0008/CONVENTIONS: o erro é logado **uma vez** aqui (com `tipo` + `status`);
 * rotas/handlers intermediários não repetem. `logger` injetável p/ teste capturar.
 */
import type { ErrorHandler } from "hono";
import { ZodError } from "zod";
import { erroResponse, HttpError, TipoErro } from "#/http/middlewares/envelope";
import { log } from "#/lib/logger";

export interface ErrorHandlerOptions {
	/** Logger injetável (testes). Default: o logger do app (`log.error`). */
	logger?: (obj: { err: unknown; tipo: string; status: number }, msg: string) => void;
}

/** Monta o detalhe de um ZodError: lista de caminhos com mensagens. */
function detalheZod(err: ZodError): Record<string, unknown> {
	const caminhos = new Set<string>();
	for (const issue of err.issues) {
		caminhos.add(issue.path.join(".") || "(root)");
	}
	return { campos: [...caminhos], issues: err.issues.map((i) => i.message) };
}

/**
 * Cria o error-handler do Hono (`app.onError(...)`). Loga o erro uma vez e responde
 * o envelope canônico.
 */
export function errorHandler(opts: ErrorHandlerOptions = {}): ErrorHandler {
	const logger = opts.logger ?? ((obj, msg) => log.error(obj, msg));
	return (err, c) => {
		let corpo: ReturnType<typeof erroResponse>["corpo"];
		let status: number;
		if (err instanceof HttpError) {
			({ corpo, status } = err.toResponse());
		} else if (err instanceof ZodError) {
			({ corpo, status } = erroResponse(TipoErro.VALIDACAO, "validação bloqueante", detalheZod(err), 422));
		} else {
			({ corpo, status } = erroResponse(TipoErro.ERRO_INTERNO, "erro interno não-classificado"));
		}
		logger({ err, tipo: corpo.erro.tipo, status }, "rota falhou");
		return c.json(corpo, status as 200);
	};
}
