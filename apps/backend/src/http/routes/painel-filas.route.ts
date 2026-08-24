/**
 * Rota de observabilidade de filas do painel (GET /api/filas — fila BullMQ
 * em tempo real).
 *
 * Rota fina (ADR-0007): sessão (cookie `painel_sess`, como todas as rotas de
 * dados do painel) + delegação ao inspetor injetado. Erros de BullMQ/Redis
 * propagam ao `errorHandler` canônico → 500 ERRO_INTERNO (o viewer mostra o
 * estado de erro e repete o poll).
 */
import { Hono } from "hono";
import { errorHandler } from "#/http/middlewares/error-handler";
import type { PainelSession } from "#/http/middlewares/painel-session";
import type { FilasSnapshot } from "#/lib/queue-inspector";

export interface PainelFilasDeps {
	session: PainelSession;
	/** Inspeciona as filas canônicas (ligado pelo composition root). */
	inspecionar: () => Promise<FilasSnapshot>;
}

/** Constrói as rotas de filas do painel com deps injetados. */
export function criarPainelFilasRoutes({
	session,
	inspecionar,
}: PainelFilasDeps): Hono {
	const app = new Hono();

	// Sessão em TODAS as rotas (idem painel-data) — sem cookie válido → 401.
	app.use("*", session.middleware);
	app.onError(errorHandler());

	// ============================================================
	// GET /api/filas (snapshot das filas BullMQ — o viewer faz poll)
	// ============================================================
	app.get("/api/filas", async (c) => {
		const snapshot = await inspecionar();
		return c.json(snapshot, 200);
	});

	return app;
}
