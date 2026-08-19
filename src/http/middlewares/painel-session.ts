/**
 * Sessão do painel de visualização de faturas/notas (cookie assinado).
 *
 * O painel autentica contra o NocoBase (auth:signIn) e guarda a sessão num
 * cookie `painel_sess` **assinado com HMAC-SHA256** (secret =
 * `env.PAINEL_COOKIE_SECRET`, ligado pelo composition root). O cookie é
 * opaco — o server não mantém estado: o payload `{ token, userId, nickname,
 * exp }` + assinatura viajam no próprio cookie (HttpOnly, SameSite=Lax).
 *
 * `exp` = 30min; a cada requisição válida o exp é **renovado** (sliding) e o
 * cookie reemitido — a sessão mora no NocoBase (`auth:check`), o cookie é só o
 * portador do token. Sem `PAINEL_COOKIE_SECRET` → o painel não é montado
 * (server.ts), então o secret aqui sempre existe.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { erroResponse, TipoErro } from "#/http/middlewares/envelope";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { AuthNocoBaseClient, SessaoNocoBase } from "#/modules/atacado/translators/auth";

/** Nome do cookie de sessão do painel. */
export const PAINEL_COOKIE = "painel_sess";
/** Duração da sessão (sliding) — 30min. */
const PAINEL_SESSAO_MS = 30 * 60 * 1000;

/** Payload da sessão no cookie (o token NocoBase é o coração da sessão). */
export interface SessaoData {
	token: string;
	userId?: number;
	nickname?: string;
	exp: number;
}

export interface PainelSession {
	/** Valida o cookie (HMAC ok + não expirado) e popula `c.set('painelUser', ...)`. */
	middleware: MiddlewareHandler;
	/** Emite o cookie de sessão após um `signIn` bem-sucedido. */
	signInCookie: (c: Context, sessao: SessaoNocoBase) => void;
	/** Remove o cookie de sessão (logout). */
	clearCookie: (c: Context) => void;
	/** Lê e valida o cookie sem passar pelo middleware (ex.: GET /api/session). */
	getSession: (c: Context) => SessaoData | null;
}

/**
 * Opção `secure` do cookie: `true` só em produção (HTTPS); em dev/local o
 * preview pode vir por HTTP (túnel), então o cookie segue sem `Secure`.
 */
function secureCookie(): boolean {
	return process.env.NODE_ENV === "production";
}

/** HMAC-SHA256 hex do payload com o secret (assinatura do cookie). */
function assinar(payload: string, secret: string): string {
	return createHmac("sha256", secret).update(payload).digest("hex");
}

/** Comparação em tempo constante (anti timing attack) — hex de mesmo tamanho. */
function mesmoSignature(a: string, b: string): boolean {
	const ba = Buffer.from(a, "hex");
	const bb = Buffer.from(b, "hex");
	if (ba.length !== bb.length) return false;
	return timingSafeEqual(ba, bb);
}

/**
 * Cria a sessão do painel: cookie `painel_sess` assinado com HMAC-SHA256.
 * O `authClient` é aceito p/ contexto (a validação do token no NocoBase é por
 * conta de quem precisa — o middleware valida a **assinatura** e a expiração,
 * não a sessão remota).
 */
export function criarPainelSessionMiddleware(
	secret: string,
	_authClient: AuthNocoBaseClient,
): PainelSession {
	const opcoesCookie = {
		httpOnly: true,
		sameSite: "Lax" as const,
		path: "/",
		...(secureCookie() ? { secure: true } : {}),
	};

	/** Lê o cookie, confere assinatura + expiração. `null` em qualquer falha. */
	const getSession = (c: Context): SessaoData | null => {
		const raw = getCookie(c, PAINEL_COOKIE);
		if (!raw) return null;
		// Formato: `<base64url(payload)>.<hmac-hex>`.
		const idx = raw.lastIndexOf(".");
		if (idx <= 0) return null;
		const payloadB64 = raw.slice(0, idx);
		const assinatura = raw.slice(idx + 1);
		const esperado = assinar(payloadB64, secret);
		if (!mesmoSignature(assinatura, esperado)) return null;
		let payload: Partial<SessaoData>;
		try {
			payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
		} catch {
			return null;
		}
		if (typeof payload.token !== "string" || !payload.token) return null;
		if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
		const sessao: SessaoData = {
			token: payload.token,
			exp: payload.exp,
		};
		if (typeof payload.userId === "number") sessao.userId = payload.userId;
		if (typeof payload.nickname === "string") sessao.nickname = payload.nickname;
		return sessao;
	};

	const emitir = (c: Context, sessao: SessaoData) => {
		const payloadB64 = Buffer.from(JSON.stringify(sessao), "utf8").toString("base64url");
		const cookie = `${payloadB64}.${assinar(payloadB64, secret)}`;
		setCookie(c, PAINEL_COOKIE, cookie, {
			...opcoesCookie,
			maxAge: Math.round(PAINEL_SESSAO_MS / 1000),
		});
	};

	const middleware: MiddlewareHandler = async (c, next) => {
		const sessao = getSession(c);
		if (!sessao) {
			const { corpo, status } = erroResponse(
				TipoErro.NAO_AUTORIZADO,
				"sessão inválida",
			);
			return c.json(corpo, status as ContentfulStatusCode);
		}
		// Popula o contexto p/ as rotas (c.set('painelUser', ...)).
		c.set("painelUser", {
			token: sessao.token,
			userId: sessao.userId,
			nickname: sessao.nickname,
		});
		// Sliding: renova o exp (reemite o cookie) a cada requisição válida.
		emitir(c, { ...sessao, exp: Date.now() + PAINEL_SESSAO_MS });
		await next();
	};

	const signInCookie = (c: Context, sessao: SessaoNocoBase) => {
		emitir(c, {
			token: sessao.token,
			userId: sessao.userId,
			nickname: sessao.nickname,
			exp: Date.now() + PAINEL_SESSAO_MS,
		});
	};

	const clearCookie = (c: Context) => {
		deleteCookie(c, PAINEL_COOKIE, opcoesCookie);
	};

	return { middleware, signInCookie, clearCookie, getSession };
}
