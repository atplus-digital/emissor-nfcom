/**
 * Rotas de auth do painel de visualização (login/logout/sessão).
 *
 * `POST /api/login` autentica no NocoBase (`authClient.signIn`) e emite o
 * cookie assinado `painel_sess` (sliding, 30min). `POST /api/logout` remove o
 * cookie. `GET /api/session` devolve o user da sessão válida.
 *
 * Envelope de erro (CONVENTIONS): `erroResponse` → `{corpo, status}`. O
 * `errorHandler` canônico está montado no app pai (`criarApp`, server.ts) —
 * erros inesperados aqui (5xx de rede no signIn, etc.) sobem até ele; o login
 * ainda assim trata o `AuthNocoBaseError` explicitamente (401 p/ o front).
 */
import { Hono } from "hono";
import { z } from "zod";
import { erroResponse, TipoErro } from "#/http/middlewares/envelope";
import { errorHandler } from "#/http/middlewares/error-handler";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { log } from "#/lib/logger";
import type {
	AuthNocoBaseClient,
	SessaoNocoBase,
} from "#/modules/atacado/translators/auth";
import { AuthNocoBaseError } from "#/modules/atacado/translators/auth";
import type { PainelSession } from "#/http/middlewares/painel-session";

/** Dependências injetadas (o composition root liga os reais). */
export interface PainelAuthDeps {
	session: PainelSession;
	authClient: AuthNocoBaseClient;
}

const loginBodySchema = z.object({
	account: z.string().min(1),
	password: z.string().min(1),
});

/** Constrói as rotas de auth do painel com deps injetadas. */
export function criarPainelAuthRoutes(deps: PainelAuthDeps): Hono {
	const { session, authClient } = deps;
	const app = new Hono();

	// Mesmo error-handler canônico das rotas de fatura (mesmo handler do app
	// pai em server.ts) — montado no sub-app p/ testabilidade isolada.
	app.onError(errorHandler());

	// ============================================================
	// POST /api/login
	// ============================================================
	app.post("/api/login", async (c) => {
		const parsed = loginBodySchema.safeParse(await c.req.json().catch(() => undefined));
		if (!parsed.success) {
			const { corpo, status } = erroResponse(
				TipoErro.VALIDACAO,
				"Body inválido",
				parsed.error.flatten() as Record<string, unknown>,
			);
			return c.json(corpo, status as ContentfulStatusCode);
		}

		let sessao: SessaoNocoBase;
		try {
			sessao = await authClient.signIn(parsed.data.account, parsed.data.password);
		} catch (err) {
			if (err instanceof AuthNocoBaseError && err.statusCode === 401) {
				const { corpo, status } = erroResponse(
					TipoErro.NAO_AUTORIZADO,
					"credenciais inválidas",
				);
				return c.json(corpo, status as ContentfulStatusCode);
			}
			// Outro erro (5xx do NocoBase, rede) → 500 logado (uma vez).
			log.error({ err }, "painel: falha no signIn NocoBase");
			const { corpo, status } = erroResponse(TipoErro.ERRO_INTERNO, "erro interno não-classificado");
			return c.json(corpo, status as ContentfulStatusCode);
		}

		session.signInCookie(c, sessao);
		return c.json(
			{
				ok: true,
				user: { id: sessao.userId, nickname: sessao.nickname },
			},
			200,
		);
	});

	// ============================================================
	// POST /api/logout
	// ============================================================
	app.post("/api/logout", (c) => {
		session.clearCookie(c);
		return c.json({ ok: true }, 200);
	});

	// ============================================================
	// GET /api/session
	// ============================================================
	app.get("/api/session", (c) => {
		const sessao = session.getSession(c);
		if (!sessao) {
			const { corpo, status } = erroResponse(
				TipoErro.NAO_AUTORIZADO,
				"sessão inválida",
			);
			return c.json(corpo, status as ContentfulStatusCode);
		}
		return c.json(
			{
				user: { id: sessao.userId, nickname: sessao.nickname },
			},
			200,
		);
	});

	return app;
}
