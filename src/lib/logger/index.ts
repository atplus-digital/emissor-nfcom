/**
 * src/lib/logger/index.ts — factory única de pino (ADR-0008).
 *
 * - JSON em produção, `pino-pretty` em dev (decidido por NODE_ENV no factory).
 * - Redação por allowlist no nível do factory: CPF/CNPJ e headers de autenticação
 *   nunca chegam ao output, independentemente do call site.
 * - Contexto de correlação via AsyncLocalStorage (mescla o store em cada linha).
 * - Nível default `info`, configurável via opção (o composition root passa env.LOG_LEVEL).
 *
 * Regras (ADR-0008): nenhuma camada instancia pino direto — só `import { log }`.
 * console.* proibido em src/. Erro sempre `log.error({ err }, "msg")`.
 */
import pinoPretty from "pino-pretty";
import pino, { type DestinationStream, type Logger, type LoggerOptions } from "pino";
import { getLogContext, type LogContext } from "./context.ts";

/**
 * Caminhos redigidos (allowlist canônica de CONVENTIONS.md · Logging):
 * - CPF/CNPJ: chaves comuns de documento (string/number em qualquer call site).
 * - headers de autenticação: access_token, X-API-Key, X-Webhook-Signature, Authorization.
 */
const REDACT_PATHS = [
	"cpfcnpj",
	"documento",
	"cpf",
	"cnpj",
	"access_token",
	"X-API-Key",
	"X-Webhook-Signature",
	"Authorization",
];

export interface CreateLoggerOptions {
	/** Destino de escrita (testes capturam em memória; default = stdout). */
	destination?: DestinationStream;
	/** Nível de log (default info; o composition root passa env.LOG_LEVEL). */
	level?: pino.LevelWithSilent;
	/** Força pretty mesmo em produção (default: derivado de NODE_ENV). */
	pretty?: boolean;
}

/**
 * Determina se o output é pretty: opção explícita, senão dev quando
 * NODE_ENV !== 'production'.
 */
function usePretty(prettyOpt: boolean | undefined): boolean {
	if (prettyOpt !== undefined) return prettyOpt;
	return process.env.NODE_ENV !== "production";
}

/**
 * Opções base do pino: nível, redação e mescla do contexto ALS em cada linha.
 */
function baseOptions(level: pino.LevelWithSilent): LoggerOptions {
	return {
		level,
		redact: {
			paths: REDACT_PATHS,
			censor: "[Redacted]",
		},
		mixin() {
			// mescla o contexto ALS em cada linha de log (faturaId, jobId, ...)
			const ctx = getLogContext() as LogContext | undefined;
			return ctx ?? {};
		},
	};
}

/**
 * Cria um logger pino com redação + mescla de contexto ALS.
 *
 * Em dev (ou pretty=true) usa `pino-pretty` como transform **síncrono em processo**
 * (não transport em worker thread), de modo que um `destination` de captura (testes)
 * seja respeitado. Em produção, JSON direto no destination.
 */
export function createLogger(opts: CreateLoggerOptions = {}): Logger {
	const pretty = usePretty(opts.pretty);
	const level = opts.level ?? "info";
	const options = baseOptions(level);

	if (pretty) {
		const prettyStream = pinoPretty({
			destination: opts.destination,
			translateTime: "SYS:standard",
			ignore: "pid,hostname",
			sync: true,
		});
		return pino(options, prettyStream) as unknown as Logger;
	}

	return pino(options, opts.destination) as unknown as Logger;
}

/**
 * Logger singleton do app. JSON em prod / pretty em dev. O composition root pode
 * recriar com `createLogger({ level: env.LOG_LEVEL })` se precisar; em testes,
 * prefira `createLogger({ destination })` para capturar output.
 */
export const log = createLogger();

export { runWithLogContext, getLogContext } from "./context.ts";
export type { LogContext } from "./context.ts";
