/**
 * src/lib/logger/context.ts — contexto de correlação via AsyncLocalStorage (ADR-0008).
 *
 * O store carrega os campos de correlação do fluxo corrente (faturaId, jobId, fila,
 * metodo, rota). O logger mescla o store em cada linha; middleware Hono e wrapper de
 * jobs BullMQ populam o store. Domínio e ACLs chamam log.info(...) sem saber da
 * mecânica.
 */
import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Campos de correlação que viajam pelo fluxo (rota HTTP → fila → integrações).
 * Todos opcionais — cada ponto popula o que souber.
 */
export interface LogContext {
	faturaId?: number;
	jobId?: string;
	fila?: string;
	metodo?: string;
	rota?: string;
}

const als = new AsyncLocalStorage<LogContext>();

/**
 * Executa `fn` dentro de um store de contexto de correlação. Chamado pelo middleware
 * HTTP e pelo wrapper de jobs BullMQ. Aninhamento sobrescreve (filho vê o seu
 * contexto); ao sair, o pai restaura.
 */
export function runWithLogContext<T>(ctx: LogContext, fn: () => T): T {
	// merge com o contexto pai se houver (filho herda o que o pai não redefinir)
	const parent = als.getStore();
	const merged = parent ? { ...parent, ...ctx } : { ...ctx };
	return als.run(merged, fn);
}

/**
 * Retorna o contexto de correlação corrente, ou undefined fora de um store.
 */
export function getLogContext(): LogContext | undefined {
	return als.getStore();
}
