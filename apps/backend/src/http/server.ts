/**
 * Montagem do app Hono (split do composition root p/ testabilidade — ADR-0007).
 *
 * `criarApp` recebe as dependências (AtacadoPort, QueuePort, apiKey, defaultsFiscais)
 * e devolve um app Hono pronto para `app.request(...)` em testes ou `app.listen()`
 * no boot. NÃO importa `env` (a API key e defaults vêm injetados; o composition root
 * `src/index.ts` liga os valores reais de env). Assim testes constroem o app sem .env.
 *
 * Camadas: request-log (ALS) → api-key → error-handler → rotas (/faturas, /health)
 * + /painel (auth cookie NocoBase) quando `painelCookieSecret` E `authNocoBase`
 * estão presentes (o painel é opcional — sem o secret, o app segue como antes).
 */
import { Hono } from "hono";
import type { AtacadoPort } from "#/domain/ports/atacado.port";
import type { QueuePort } from "#/domain/ports/queue.port";
import type { DefaultsFiscais } from "#/domain/fatura/defaults-fiscais";
import { criarFaturasRoutes } from "#/http/routes/faturas.route";
import { criarHealthRoute, pingSqlite } from "#/http/routes/health.route";
import { criarPainelAuthRoutes } from "#/http/routes/painel-auth.route";
import { criarPainelDataRoutes } from "#/http/routes/painel-data.route";
import { criarPainelSessionMiddleware } from "#/http/middlewares/painel-session";
import type { AuthNocoBaseClient } from "#/modules/atacado/translators/auth";
import type { CoordDB } from "@emissor/db/client";
import { apiKeyMiddleware } from "#/http/middlewares/api-key";
import { requestLogMiddleware } from "#/http/middlewares/request-log";
import { errorHandler } from "#/http/middlewares/error-handler";

export interface AppDeps {
	atacado: AtacadoPort;
	queue: QueuePort;
	/** API key do header X-API-Key (env.EMISSOR_API_KEY ligado pelo composition root). */
	apiKey: string;
	/** Defaults fiscais (env.FISCAL_* ligado pelo composition root). */
	defaultsFiscais?: DefaultsFiscais;
	/** Fallback de IE p/ destinatário isento (env.FISCAL_IE_ISENTO, Defeito B). */
	ieIsento?: string;
	/** DB de coordenação p/ o ping do /health (ADR-0002). Injete ou omita p/ liveness puro. */
	db?: CoordDB;
	/**
	 * Nível de log do app (env.LOG_LEVEL). `debug`/`trace` ligam o detalhe de
	 * `ERRO_INTERNO` na resposta de erro (mensagem + stack) — diagnóstico sem
	 * exposição em produção (default off, nível info).
	 */
	logLevel?: string;
	/**
	 * Secret do cookie de sessão do painel (env.PAINEL_COOKIE_SECRET).
	 * **Opcional**: ausente → painel desligado (o app segue sem /painel).
	 */
	painelCookieSecret?: string;
	/** Cliente de auth do NocoBase p/ o painel (signIn/check). */
	authNocoBase?: AuthNocoBaseClient;
	/** Id do autenticador NocoBase (env.NOCOBASE_AUTHENTICATOR) — contexto do painel. */
	nocobaseAuthenticator?: string;
}

/**
 * Cria o app Hono com middlewares + rotas. Sem env, sem redis — só wiring HTTP.
 */
export function criarApp(deps: AppDeps): Hono {
	const app = new Hono();

	// Middlewares globais (ordem importa): request-log primeiro (popula ALS),
	// depois api-key, depois error-handler (onError). O debug (LOG_LEVEL) liga o
	// detalhe de ERRO_INTERNO na resposta — ver error-handler.ts.
	app.use("*", requestLogMiddleware());
	const logLevel = deps.logLevel;
	const debugErro = logLevel === "debug" || logLevel === "trace";
	app.onError(errorHandler({ debug: debugErro }));

	// Health é público (liveness — não exige auth; ADR-0002). O ping do SQLite é
	// ligado quando o composition root injeta o `db`; senão liveness puro.
	app.route("/", criarHealthRoute(deps.db ? pingSqlite(deps.db) : undefined));

	// Painel de visualização (opcional): montado ANTES do api-key p/ não exigir
	// X-API-Key — a auth é o cookie de sessão do NocoBase (painel_sess). Só
	// existe quando `painelCookieSecret` E `authNocoBase` estão presentes.
	if (deps.painelCookieSecret && deps.authNocoBase) {
		const session = criarPainelSessionMiddleware(
			deps.painelCookieSecret,
			deps.authNocoBase,
		);
		const painel = new Hono();
		painel.route("/", criarPainelAuthRoutes({ session, authClient: deps.authNocoBase }));
		painel.route("/", criarPainelDataRoutes({ atacado: deps.atacado, session }));
		app.route("/painel", painel);
	}

	// Rotas protegidas por API key
	app.use("*", apiKeyMiddleware(deps.apiKey));
	app.route("/", criarFaturasRoutes({ atacado: deps.atacado, queue: deps.queue, defaultsFiscais: deps.defaultsFiscais, ieIsento: deps.ieIsento }));

	return app;
}
