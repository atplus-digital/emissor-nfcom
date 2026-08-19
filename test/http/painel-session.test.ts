/**
 * Sessão do painel (cookie assinado) — `src/http/middlewares/painel-session.ts`.
 *
 * Contrato:
 * - `criarPainelSessionMiddleware(secret, authClient)` →
 *   `{ middleware, signInCookie, clearCookie, getSession }`.
 * - Cookie `painel_sess` HttpOnly; formato `<base64url(payload)>.<hmac-hex>`
 *   com payload `{ token, userId?, nickname?, exp }` assinado HMAC-SHA256.
 * - O middleware valida assinatura + exp (sem chamar o NocoBase): válido →
 *   popula `c.set('painelUser', ...)` e segue o `next` (reemite o cookie com
 *   exp renovado — sliding); inválido/expirado → 401 NAO_AUTORIZADO.
 *
 * O `authClient` é fake — a validação local (HMAC/exp) não o consulta.
 */
import { describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import { Hono } from "hono";
import {
	criarPainelSessionMiddleware,
	PAINEL_COOKIE,
} from "#/http/middlewares/painel-session";
import type { AuthNocoBaseClient } from "#/modules/atacado/translators/auth";

const SECRET = "segredo-de-teste-painel";

/** authClient fake — a validação local (HMAC/exp) não o chama. */
function fakeAuthClient(): AuthNocoBaseClient {
	return {
		signIn: async (account: string) => ({
			token: "tok-1",
			userId: 1,
			nickname: account,
			email: `${account}@x.com`,
		}),
		check: async () => true,
	};
}

/** Assina um payload de sessão como o módulo (`base64url.hex-hmac`). */
function assinarCookie(payload: Record<string, unknown>, secret: string = SECRET): string {
	const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
	const sig = createHmac("sha256", secret).update(payloadB64).digest("hex");
	return `${PAINEL_COOKIE}=${payloadB64}.${sig}`;
}

/** Monta um app Hono só para extrair set-cookie via app.request. */
function appEmissor(s: { signInCookie: (c: any, sessao: any) => void }) {
	const app = new Hono();
	app.post("/set", (c) => {
		s.signInCookie(c, { token: "tok-1", userId: 1, nickname: "bob" });
		return c.body(null, 204);
	});
	return app;
}

describe("criarPainelSessionMiddleware > middleware", () => {
	test("cookie válido → popula painelUser e segue o next (200)", async () => {
		const s = criarPainelSessionMiddleware(SECRET, fakeAuthClient());
		const cookie = assinarCookie({ token: "tok-1", userId: 1, nickname: "bob", exp: Date.now() + 60_000 });
		const app = new Hono();
		app.use("*", s.middleware);
		app.get("*", (c) => c.json({ user: c.get("painelUser") ?? null }));
		const res = await app.request("/qualquer", { headers: { cookie } });
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.user).toMatchObject({ token: "tok-1", userId: 1, nickname: "bob" });
	});

	test("sliding renewal: cookie válido → reemite painel_sess com exp renovado", async () => {
		const s = criarPainelSessionMiddleware(SECRET, fakeAuthClient());
		const cookie = assinarCookie({ token: "tok-1", exp: Date.now() + 60_000 });
		const app = new Hono();
		app.use("*", s.middleware);
		app.get("*", (c) => c.json({}));
		const res = await app.request("/qualquer", { headers: { cookie } });
		const setCookie = res.headers.get("set-cookie") ?? "";
		expect(setCookie.toLowerCase()).toContain("painel_sess=");
		// exp renovado ~ 30min a partir de agora.
		const m = setCookie.match(/painel_sess=([^;]+)/);
		if (!m) throw new Error("set-cookie sem painel_sess");
		const [payloadB64] = m[1].split(".");
		const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
		const diffMin = (payload.exp - Date.now()) / 60_000;
		expect(diffMin).toBeGreaterThan(29);
		expect(diffMin).toBeLessThanOrEqual(30);
	});

	test("cookie adulterado (HMAC inválido) → 401 NAO_AUTORIZADO", async () => {
		const s = criarPainelSessionMiddleware(SECRET, fakeAuthClient());
		let cookie = assinarCookie({ token: "tok-1", exp: Date.now() + 60_000 });
		// Inverte um caractere do payload mantendo o formato (quebra o HMAC).
		const i = cookie.indexOf("=") + 2;
		cookie = cookie.slice(0, i) + (cookie[i] === "a" ? "b" : "a") + cookie.slice(i + 1);
		const app = new Hono();
		app.use("*", s.middleware);
		app.get("*", (c) => c.json({}));
		const res = await app.request("/qualquer", { headers: { cookie } });
		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body.erro.tipo).toBe("NAO_AUTORIZADO");
		expect(body.erro.mensagem).toBeTruthy();
	});

	test("assinatura válida com outro secret → 401 (secret divergente)", async () => {
		const s = criarPainelSessionMiddleware(SECRET, fakeAuthClient());
		const cookie = assinarCookie({ token: "tok-1", exp: Date.now() + 60_000 }, "outro-secret");
		const app = new Hono();
		app.use("*", s.middleware);
		app.get("*", (c) => c.json({}));
		const res = await app.request("/qualquer", { headers: { cookie } });
		expect(res.status).toBe(401);
	});

	test("cookie expirado → 401 NAO_AUTORIZADO", async () => {
		const s = criarPainelSessionMiddleware(SECRET, fakeAuthClient());
		const cookie = assinarCookie({ token: "tok-1", exp: Date.now() - 1000 });
		const app = new Hono();
		app.use("*", s.middleware);
		app.get("*", (c) => c.json({}));
		const res = await app.request("/qualquer", { headers: { cookie } });
		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body.erro.tipo).toBe("NAO_AUTORIZADO");
	});

	test("sem cookie → 401 NAO_AUTORIZADO", async () => {
		const s = criarPainelSessionMiddleware(SECRET, fakeAuthClient());
		const app = new Hono();
		app.use("*", s.middleware);
		app.get("*", (c) => c.json({}));
		const res = await app.request("/qualquer");
		expect(res.status).toBe(401);
	});
});

describe("criarPainelSessionMiddleware > helpers de cookie", () => {
	test("signInCookie seta painel_sess HttpOnly com exp futuro; getSession(c) extrai o user", async () => {
		const s = criarPainelSessionMiddleware(SECRET, fakeAuthClient());
		const res = await appEmissor(s).request("/set", { method: "POST" });
		const setCookie = res.headers.get("set-cookie") ?? "";
		expect(setCookie.toLowerCase()).toContain("painel_sess=");
		expect(setCookie.toLowerCase()).toContain("httponly");
		expect(setCookie.toLowerCase()).toContain("max-age=");

		// Extrai o valor e valida via getSession(c) — contexto Hono real
		// (o getCookie do Hono lê `c.req.raw.headers`).
		const raw = (setCookie.match(/painel_sess=([^;]+)/) ?? [])[1];
		const appGet = new Hono();
		appGet.get("/sessao/:cookie", (c) => c.json(s.getSession(c) ?? null));
		const resOk = await appGet.request(`/sessao/${encodeURIComponent(raw)}`, {
			headers: { cookie: `${PAINEL_COOKIE}=${raw}` },
		});
		const sessao = await resOk.json();
		expect(sessao).toMatchObject({ token: "tok-1", userId: 1, nickname: "bob" });
		expect(sessao.exp).toBeGreaterThan(Date.now());

		// Cookie adulterado → getSession null; sem cookie → null.
		const resRuim = await appGet.request(`/sessao/${encodeURIComponent(raw.slice(0, -1))}x`, {
			headers: { cookie: `${PAINEL_COOKIE}=${raw.slice(0, -1)}x` },
		});
		expect(await resRuim.json()).toBeNull();
		const resSem = await appGet.request("/sessao/vazio");
		expect(await resSem.json()).toBeNull();
	});

	test("clearCookie remove o painel_sess (expiração no passado / Max-Age=0)", async () => {
		const s = criarPainelSessionMiddleware(SECRET, fakeAuthClient());
		const app = new Hono();
		app.post("/clear", (c) => {
			s.clearCookie(c);
			return c.body(null, 204);
		});
		const res = await app.request("/clear", { method: "POST" });
		const setCookie = (res.headers.get("set-cookie") ?? "").toLowerCase();
		expect(setCookie).toContain("painel_sess=");
		expect(setCookie).toMatch(/max-age=0|expires=thu, 01 jan 1970/);
	});
});
