/**
 * Auth NocoBase (painel de visualização) — `src/modules/atacado/translators/auth.ts`.
 *
 * Contrato:
 * - `createAuthNocoBaseClient({ fetchImpl?, baseUrl?, app?, authenticator? })`
 *   → `{ signIn(account, password), check(token) }`.
 * - `signIn`: POST `${baseUrl}/auth:signIn` com header `X-Authenticator` e body
 *   `{ account, password }`; resposta `{ data: { token, ...user } }`.
 *   Credencial inválida → `AuthNocoBaseError` 401.
 * - `check`: POST `${baseUrl}/auth:check` com `Authorization: Bearer <token>`
 *   → `true` (2xx) / `false` (401/403).
 *
 * `fetchImpl` é injetado via opts; `baseUrl`/`app`/`authenticator` também, para
 * evitar disparar a validação de env (mesmo padrão do atacado.client.test.ts).
 */
import { describe, expect, it, mock } from "bun:test";
import {
	AuthNocoBaseError,
	createAuthNocoBaseClient,
} from "#/modules/atacado/translators/auth";

// Mock do env ANTES dos imports dinâmicos (a auth lê `#/env` lazy quando o
// caller não injeta baseUrl/app/authenticator — mesmo padrão do client.test.ts).
mock.module("#/env", () => ({
	env: {
		NOCOBASE_API_URL: "https://atacado.env.test/api",
		NOCOBASE_APP: "env-app",
		NOCOBASE_AUTHENTICATOR: "env-auth",
	},
}));

/** fetch fake que registra URL/headers e retorna Response-like (o client lê
 * o body via `text()`/`json()`). */
function fakeFetch(response: {
	status: number;
	body?: unknown;
}) {
	return mock((_url: string, _init?: RequestInit) =>
		Promise.resolve({
			ok: response.status >= 200 && response.status < 300,
			status: response.status,
			json: () => Promise.resolve(response.body ?? {}),
			text: () =>
				Promise.resolve(
					response.body !== undefined ? JSON.stringify(response.body) : "",
				),
		}),
	) as unknown as typeof fetch;
}

const OPTS = {
	baseUrl: "https://atacado.test",
	app: "testapp",
	authenticator: "email",
};

function calls(f: ReturnType<typeof fakeFetch>): Array<[string, RequestInit | undefined]> {
	return (f as unknown as ReturnType<typeof mock>).mock.calls as Array<
		[string, RequestInit | undefined]
	>;
}

describe("createAuthNocoBaseClient > signIn", () => {
	it("sucesso: POST /auth:signIn com X-Authenticator e body {account,password} → SessaoNocoBase", async () => {
		const f = fakeFetch({
			status: 200,
			// NocoBase entrega o user com `id` (o client mapeia p/ `userId`).
			body: { data: { token: "t", id: 1, nickname: "bob", email: "bob@x.com" } },
		});
		const auth = createAuthNocoBaseClient({ fetchImpl: f, ...OPTS });
		const s = await auth.signIn("bob@x.com", "senha");
		expect(s.token).toBe("t");
		expect(s.userId).toBe(1);
		expect(s.nickname).toBe("bob");
		expect(s.email).toBe("bob@x.com");
		// URL exata do endpoint de auth do NocoBase.
		const [url, init] = calls(f)[0];
		expect(url).toBe("https://atacado.test/auth:signIn");
		expect(init?.method).toBe("POST");
		const headers = init?.headers as Record<string, string>;
		expect(headers["X-Authenticator"]).toBe("email");
		expect(headers["X-App"]).toBe("testapp");
		const body = JSON.parse(init?.body as string);
		expect(body).toEqual({ account: "bob@x.com", password: "senha" });
	});

	it("sem app → header X-App não é enviado", async () => {
		const f = fakeFetch({ status: 200, body: { data: { token: "t" } } });
		const auth = createAuthNocoBaseClient({ fetchImpl: f, ...OPTS, app: "" });
		await auth.signIn("a", "b");
		const [, init] = calls(f)[0];
		expect((init?.headers as Record<string, string>)["X-App"]).toBeUndefined();
	});

	it("401 → AuthNocoBaseError com statusCode 401", async () => {
		const f = fakeFetch({ status: 401, body: { message: "invalid credentials" } });
		const auth = createAuthNocoBaseClient({ fetchImpl: f, ...OPTS });
		let erro: unknown;
		try {
			await auth.signIn("bob@x.com", "errada");
		} catch (e) {
			erro = e;
		}
		expect(erro).toBeInstanceOf(AuthNocoBaseError);
		expect((erro as AuthNocoBaseError).statusCode).toBe(401);
	});

	it("500 → AuthNocoBaseError com statusCode 500", async () => {
		const f = fakeFetch({ status: 500, body: { message: "boom" } });
		const auth = createAuthNocoBaseClient({ fetchImpl: f, ...OPTS });
		let erro: unknown;
		try {
			await auth.signIn("a", "b");
		} catch (e) {
			erro = e;
		}
		expect(erro).toBeInstanceOf(AuthNocoBaseError);
		expect((erro as AuthNocoBaseError).statusCode).toBe(500);
	});
});

describe("createAuthNocoBaseClient > check", () => {
	it("200 → true (token válido) com Bearer no Authorization", async () => {
		const f = fakeFetch({ status: 200, body: {} });
		const auth = createAuthNocoBaseClient({ fetchImpl: f, ...OPTS });
		expect(await auth.check("token-123")).toBe(true);
		const [url, init] = calls(f)[0];
		expect(url).toBe("https://atacado.test/auth:check");
		expect(init?.method).toBe("POST");
		const headers = init?.headers as Record<string, string>;
		expect(headers.Authorization).toBe("Bearer token-123");
	});

	it("401 → false (token inválido/expirado)", async () => {
		const f = fakeFetch({ status: 401, body: { message: "invalid token" } });
		const auth = createAuthNocoBaseClient({ fetchImpl: f, ...OPTS });
		expect(await auth.check("token-bad")).toBe(false);
	});
});

describe("createAuthNocoBaseClient · env lazy (sem opts injetados)", () => {
	it("usa env.NOCOBASE_* quando o caller não injeta creds (signIn)", async () => {
		const f = fakeFetch({ status: 200, body: { data: { token: "t-env" } } });
		const auth = createAuthNocoBaseClient({ fetchImpl: f });
		const s = await auth.signIn("a@x.com", "b");
		expect(s.token).toBe("t-env");
		const [url, init] = calls(f)[0];
		expect(url).toBe("https://atacado.env.test/api/auth:signIn");
		const headers = init?.headers as Record<string, string>;
		expect(headers["X-Authenticator"]).toBe("env-auth");
		expect(headers["X-App"]).toBe("env-app");
	});

	it("usa env.NOCOBASE_* quando o caller não injeta creds (check)", async () => {
		const f = fakeFetch({ status: 200, body: {} });
		const auth = createAuthNocoBaseClient({ fetchImpl: f });
		expect(await auth.check("token-123")).toBe(true);
		const [url] = calls(f)[0];
		expect(url).toBe("https://atacado.env.test/api/auth:check");
	});

	it("ops parciais: baseUrl do opt, app/authenticator do env", async () => {
		const f = fakeFetch({ status: 200, body: { data: { token: "t" } } });
		const auth = createAuthNocoBaseClient({ fetchImpl: f, baseUrl: "https://parcial.test" });
		await auth.signIn("a", "b");
		const [url, init] = calls(f)[0];
		expect(url).toBe("https://parcial.test/auth:signIn");
		expect((init?.headers as Record<string, string>)["X-Authenticator"]).toBe("env-auth");
	});
});
