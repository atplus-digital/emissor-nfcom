/**
 * Rota de filas do painel — `src/http/routes/painel-filas.route.ts`.
 *
 * - Sessão obrigatória (idem painel-data): sem cookie → 401 NAO_AUTORIZADO;
 *   cookie expirado → 401.
 * - `GET /api/filas` com sessão → 200 com o snapshot do inspetor (pass-through).
 * - Inspetor que rejeita (Redis fora, etc.) → 500 ERRO_INTERNO (envelope
 *   canônico via errorHandler — o viewer trata e repete o poll).
 */

import { describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import {
	criarPainelSessionMiddleware,
	PAINEL_COOKIE,
} from "#/http/middlewares/painel-session";
import { criarPainelFilasRoutes } from "#/http/routes/painel-filas.route";
import type { FilasSnapshot } from "#/lib/queue-inspector";

const SECRET = "segredo-de-teste-painel-filas";

/** Cookie de sessão válido (assinado com o secret do teste). */
function cookieValido(over: Record<string, unknown> = {}): string {
	const payload = {
		token: "tok-1",
		userId: 7,
		nickname: "bob",
		exp: Date.now() + 60_000,
		...over,
	};
	const b64 = Buffer.from(JSON.stringify(payload), "utf8").toString(
		"base64url",
	);
	const sig = createHmac("sha256", SECRET).update(b64).digest("hex");
	return `${PAINEL_COOKIE}=${b64}.${sig}`;
}

const AUTH = { cookie: cookieValido() } as Record<string, string>;

const SNAPSHOT: FilasSnapshot = {
	geradoEm: 1_700_000_000_000,
	filas: [
		{
			nome: "emissao",
			contagens: {
				waiting: 1,
				active: 0,
				delayed: 0,
				paused: 0,
				completed: 2,
				failed: 0,
			},
			pausada: false,
			workers: 1,
			jobs: [
				{
					id: "9",
					nome: "emit-fatura",
					estado: "waiting",
					tentativas: 0,
					criadoEm: 1_700_000_000_000,
					processadoEm: null,
					finalizadoEm: null,
					falha: null,
					faturaId: 101,
					paiId: null,
				},
			],
		},
	],
};

function appFilas(inspecionar: () => Promise<FilasSnapshot>) {
	const session = criarPainelSessionMiddleware(SECRET, {
		signIn: async () => ({ token: "t" }),
		check: async () => true,
	});
	return criarPainelFilasRoutes({ session, inspecionar });
}

describe("GET /api/filas — autenticação", () => {
	test("sem cookie (sem auth) → 401 NAO_AUTORIZADO", async () => {
		const res = await appFilas(async () => SNAPSHOT).request("/api/filas");
		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body.erro.tipo).toBe("NAO_AUTORIZADO");
	});

	test("cookie expirado → 401", async () => {
		const res = await appFilas(async () => SNAPSHOT).request("/api/filas", {
			headers: { cookie: cookieValido({ exp: Date.now() - 1000 }) },
		});
		expect(res.status).toBe(401);
	});
});

describe("GET /api/filas — snapshot", () => {
	test("sessão válida → 200 com o snapshot do inspetor (pass-through)", async () => {
		let chamado = 0;
		const app = appFilas(async () => {
			chamado++;
			return SNAPSHOT;
		});
		const res = await app.request("/api/filas", { headers: AUTH });
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual(SNAPSHOT);
		expect(chamado).toBe(1);
	});

	test("inspetor que rejeita (Redis fora) → 500 ERRO_INTERNO (envelope)", async () => {
		const app = appFilas(async () => {
			throw new Error("ECONNREFUSED: redis fora");
		});
		const res = await app.request("/api/filas", { headers: AUTH });
		expect(res.status).toBe(500);
		const body = await res.json();
		expect(body.erro.tipo).toBe("ERRO_INTERNO");
	});
});
