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
 *
 * `debug` (ligado pelo composition root quando `LOG_LEVEL` é `debug`/`trace`): em
 * `ERRO_INTERNO`, o `detalhe` passa a carregar `mensagem` + `stack` do erro original —
 * diagnóstico no corpo da resposta sem custo em produção (default off).
 */
import type { ErrorHandler } from "hono";
import { ZodError } from "zod";
import { erroResponse, HttpError, TipoErro } from "#/http/middlewares/envelope";
import { log } from "#/lib/logger";

export interface ErrorHandlerOptions {
	/** Logger injetável (testes). Default: o logger do app (`log.error`). */
	logger?: (obj: { err: unknown; tipo: string; status: number }, msg: string) => void;
	/** `true` → detalha `ERRO_INTERNO` na resposta (mensagem + stack). Ligado quando LOG_LEVEL=debug/trace. */
	debug?: boolean;
}

/** Monta o detalhe de um ZodError: lista de caminhos com mensagens. */
function detalheZod(err: ZodError): Record<string, unknown> {
	const caminhos = new Set<string>();
	for (const issue of err.issues) {
		caminhos.add(issue.path.join(".") || "(root)");
	}
	return { campos: [...caminhos], issues: err.issues.map((i) => i.message) };
}

const FORMATA_ERRO = (err: unknown): string => {
	if (err instanceof Error) return err.message;
	return String(err);
};

const FORMATA_STACK = (err: unknown): string | undefined => {
	if (err instanceof Error && err.stack) return err.stack;
	return undefined;
};

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
			// 500: por default o envelope é genérico (não vaza stack/detalhe interno).
			// Com `debug` (LOG_LEVEL=debug/trace), o detalhe carrega mensagem + stack
			// do erro original p/ diagnóstico no corpo da resposta.
			const detalhe =
				opts.debug && err instanceof Error
					? { mensagem: FORMATA_ERRO(err), stack: FORMATA_STACK(err) }
					: {};
			({ corpo, status } = erroResponse(TipoErro.ERRO_INTERNO, "erro interno não-classificado", detalhe));
		}
		logger({ err, tipo: corpo.erro.tipo, status }, "rota falhou");
		return c.json(corpo, status as 200);
	};
}
