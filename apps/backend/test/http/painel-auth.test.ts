/**
 * Rotas de auth do painel — `src/http/routes/painel-auth.route.ts`.
 *
 * - `POST /api/login`: 200 {ok, user} + cookie `painel_sess` assinado;
 *   body inválido → 422 VALIDACAO; `AuthNocoBaseError(401)` → 401 NAO_AUTORIZADO;
 *   outro erro do NocoBase → 500.
 * - `POST /api/logout`: 200 + cookie removido.
 * - `GET /api/session`: 200 {user} com cookie válido; 401 sem sessão.
 *
 * O session middleware é o **real** (secret de teste); o `authClient` é fake.
 */
import { describe, expect, test } from "bun:test";
import { criarPainelAuthRoutes } from "#/http/routes/painel-auth.route";
import {
	criarPainelSessionMiddleware,
	PAINEL_COOKIE,
} from "#/http/middlewares/painel-session";
import type { AuthNocoBaseClient, SessaoNocoBase } from "#/modules/atacado/translators/auth";
import { AuthNocoBaseError } from "#/modules/atacado/translators/auth";

const SECRET = "segredo-de-teste-painel-auth";

/** authClient fake — o login devolve uma sessão fixa (sobrescrevível por teste). */
function fakeAuthClient(over: Partial<AuthNocoBaseClient> = {}): AuthNocoBaseClient {
	return {
		signIn: async (account: string): Promise<SessaoNocoBase> => ({
			token: `token-${account}`,
			userId: 7,
			nickname: account,
		}),
		check: async () => true,
		...over,
	};
}

function appAuth(authClient: AuthNocoBaseClient = fakeAuthClient()) {
	const session = criarPainelSessionMiddleware(SECRET, authClient);
	return criarPainelAuthRoutes({ session, authClient });
}

/** Gera um cookie de sessão válido direto (bypass do login) p/ /api/session. */
import { createHmac } from "node:crypto";
function cookieValido(over: Record<string, unknown> = {}): string {
	const payload = { token: "tok-1", userId: 7, nickname: "bob", exp: Date.now() + 60_000, ...over };
	const b64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
	const sig = createHmac("sha256", SECRET).update(b64).digest("hex");
	return `${PAINEL_COOKIE}=${b64}.${sig}`;
}

describe("POST /api/login", () => {
	test("sucesso → 200 {ok, user} + cookie painel_sess HttpOnly", async () => {
		const res = await appAuth().request("/api/login", {
			method: "POST",
			body: JSON.stringify({ account: "bob@x.com", password: "senha" }),
		});
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.ok).toBe(true);
		expect(body.user).toMatchObject({ id: 7, nickname: "bob@x.com" });
		const setCookie = res.headers.get("set-cookie") ?? "";
		expect(setCookie.toLowerCase()).toContain(`${PAINEL_COOKIE}=`);
		expect(setCookie.toLowerCase()).toContain("httponly");
	});

	test("body inválido (sem password) → 422 VALIDACAO", async () => {
		const res = await appAuth().request("/api/login", {
			method: "POST",
			body: JSON.stringify({ account: "bob@x.com" }),
		});
		expect(res.status).toBe(422);
		const body = await res.json();
		expect(body.erro.tipo).toBe("VALIDACAO");
		expect(body.erro.mensagem).toBeTruthy();
	});

	test("body não-JSON → 422 VALIDACAO", async () => {
		const res = await appAuth().request("/api/login", {
			method: "POST",
			body: "isso nao é json",
		});
		expect(res.status).toBe(422);
		const body = await res.json();
		expect(body.erro.tipo).toBe("VALIDACAO");
	});

	test("credencial inválida (AuthNocoBaseError 401) → 401 NAO_AUTORIZADO, sem cookie", async () => {
		const app = appAuth(
			fakeAuthClient({
				signIn: async () => {
					throw new AuthNocoBaseError("auth NocoBase signIn 401", 401);
				},
			}),
		);
		const res = await app.request("/api/login", {
			method: "POST",
			body: JSON.stringify({ account: "bob@x.com", password: "errada" }),
		});
		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body.erro.tipo).toBe("NAO_AUTORIZADO");
		expect(res.headers.get("set-cookie")).toBeNull();
	});

	test("erro 500 do NocoBase → 500 ERRO_INTERNO", async () => {
		const app = appAuth(
			fakeAuthClient({
				signIn: async () => {
					throw new AuthNocoBaseError("auth NocoBase signIn 500", 500);
				},
			}),
		);
		const res = await app.request("/api/login", {
			method: "POST",
			body: JSON.stringify({ account: "bob@x.com", password: "x" }),
		});
		expect(res.status).toBe(500);
		const body = await res.json();
		expect(body.erro.tipo).toBe("ERRO_INTERNO");
	});
});

describe("POST /api/logout", () => {
	test("→ 200 {ok} e cookie removido (expirado no passado)", async () => {
		const res = await appAuth().request("/api/logout", { method: "POST" });
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.ok).toBe(true);
		const setCookie = (res.headers.get("set-cookie") ?? "").toLowerCase();
		expect(setCookie).toContain(`${PAINEL_COOKIE.toLowerCase()}=`);
		expect(setCookie).toMatch(/max-age=0|expires=thu, 01 jan 1970/);
	});
});

describe("GET /api/session", () => {
	test("cookie válido → 200 {user}", async () => {
		const res = await appAuth().request("/api/session", {
			headers: { cookie: cookieValido() },
		});
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.user).toMatchObject({ id: 7, nickname: "bob" });
	});

	test("sem cookie → 401 NAO_AUTORIZADO", async () => {
		const res = await appAuth().request("/api/session");
		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body.erro.tipo).toBe("NAO_AUTORIZADO");
	});

	test("cookie expirado → 401 NAO_AUTORIZADO", async () => {
		const res = await appAuth().request("/api/session", {
			headers: { cookie: cookieValido({ exp: Date.now() - 1000 }) },
		});
		expect(res.status).toBe(401);
	});
});
