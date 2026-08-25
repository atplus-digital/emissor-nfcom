/**
 * Middleware de estáticos do viewer (`viewer-static.ts`).
 *
 * ServerValidator do mesmo-origin: o backend serve o SPA (estáticos + fallback)
 * no mesmo origin de `/painel`. Cobertura dos dois handlers:
 * - `assetsHandler` (GET /assets/*): serve o arquivo ou 404.
 * - `spaFallback` (GET /* com Accept html): serve `index.html` em rotas de SPA;
 *   `next()` em paths reservados à API, em não-GET, ou sem Accept html.
 * - `viewerDist` ausente (dir sem index.html) → fallback faz `next()` (não serve).
 *
 * (DoD: arquivo novo em src/** nasce a 0% e quebra o gate — este teste cobre.)
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Hono } from "hono";
import { criarViewerStatic } from "#/http/middlewares/viewer-static";

let dir: string;

async function mkViewer(comIndex = true): Promise<string> {
	const d = await mkdtemp(join(tmpdir(), "viewer-"));
	if (comIndex)
		await writeFile(
			join(d, "index.html"),
			"<!doctype html><html><body>SPA</body></html>",
		);
	await mkdir(join(d, "assets"), { recursive: true });
	await writeFile(join(d, "assets", "app.js"), "console.log('app');");
	await writeFile(join(d, "assets", "style.css"), "body{color:red}");
	return d;
}

function mkApp(dir: string, opts?: { apiFallback?: boolean }) {
	const { assetsHandler, spaFallback } = criarViewerStatic({ viewerDist: dir });
	const app = new Hono();
	// Replica a ordem de server.ts: assets → spaFallback → (apiKey/rotas).
	app.get("/assets/*", assetsHandler);
	app.get("*", spaFallback);
	if (opts?.apiFallback) {
		// Simula a rota de API após o api-key: rotas reservadas respondem JSON.
		app.get("/faturas/:id/emissao", (c) =>
			c.json({ ok: true, id: c.req.param("id") }),
		);
		app.get("*", (c) => c.json({ erro: "NAO_AUTORIZADO" }, 401));
	}
	return app;
}

beforeEach(async () => {
	dir = await mkViewer();
});
afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
});

describe("criarViewerStatic — assetsHandler (GET /assets/*)", () => {
	it("serve arquivo de asset existente com content-type correto", async () => {
		const app = mkApp(dir, { apiFallback: true });
		const res = await app.request("/assets/app.js");
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("javascript");
		expect(await res.text()).toContain("console.log");
	});

	it("serve CSS com content-type text/css", async () => {
		const app = mkApp(dir, { apiFallback: true });
		const res = await app.request("/assets/style.css");
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/css");
	});

	it("asset inexistente cai no próximo handler (401 do apiFallback)", async () => {
		const app = mkApp(dir, { apiFallback: true });
		const res = await app.request("/assets/nao-tem.js");
		// serveStatic não found → next → catch-all 401 do apiFallback.
		expect(await res.json()).toEqual({ erro: "NAO_AUTORIZADO" });
	});
});

describe("criarViewerStatic — spaFallback (GET /* html)", () => {
	it("GET / com Accept html serve index.html (200 text/html)", async () => {
		const app = mkApp(dir, { apiFallback: true });
		const res = await app.request("/", { headers: { accept: "text/html" } });
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/html");
		expect(await res.text()).toContain("SPA");
	});

	it("GET /faturas/123 (rota de SPA) com Accept html serve index.html", async () => {
		const app = mkApp(dir, { apiFallback: true });
		const res = await app.request("/faturas/123", {
			headers: { accept: "text/html,application/xhtml+xml" },
		});
		expect(res.status).toBe(200);
		expect(await res.text()).toContain("SPA");
	});

	it("GET /parceiros/42 com Accept html serve index.html (SPA route)", async () => {
		const app = mkApp(dir, { apiFallback: true });
		const res = await app.request("/parceiros/42", {
			headers: { accept: "text/html" },
		});
		expect(res.status).toBe(200);
		expect(await res.text()).toContain("SPA");
	});

	it("GET /faturas/123/emissao com Accept json NÃO serve HTML → cai na API", async () => {
		const app = mkApp(dir, { apiFallback: true });
		const res = await app.request("/faturas/123/emissao", {
			headers: { accept: "application/json" },
		});
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true, id: "123" });
	});

	it("GET /faturas/123 sem Accept html (Accept */*) cai no catch-all", async () => {
		const app = mkApp(dir, { apiFallback: true });
		// Accept */* NÃO contém text/html → spaFallback next → catch-all 401.
		const res = await app.request("/faturas/123", {
			headers: { accept: "*/*" },
		});
		expect(res.status).toBe(401);
		expect(await res.json()).toEqual({ erro: "NAO_AUTORIZADO" });
	});

	it("path reservado /health com Accept html NÃO serve HTML → next", async () => {
		const app = mkApp(dir, { apiFallback: true });
		const res = await app.request("/health", {
			headers: { accept: "text/html" },
		});
		// /health é reservado → fallback next → catch-all 401 (aqui sem rota real).
		expect(res.status).toBe(401);
	});

	it("path reservado /painel/api/session com Accept html → next (401 do catch-all)", async () => {
		const app = mkApp(dir, { apiFallback: true });
		const res = await app.request("/painel/api/session", {
			headers: { accept: "text/html" },
		});
		expect(res.status).toBe(401);
	});

	it("POST /login com Accept html NÃO serve HTML (não-GET → next)", async () => {
		const app = mkApp(dir, { apiFallback: true });
		const res = await app.request("/login", {
			method: "POST",
			headers: { accept: "text/html" },
		});
		// POST não é GET → spaFallback next → só há GET * no app → 404.
		expect(res.status).toBe(404);
	});
});

describe("criarViewerStatic — viewerDist sem index.html", () => {
	beforeEach(async () => {
		// Recria o dir sem index.html (simula viewerDist inválido/vazio).
		await rm(dir, { recursive: true, force: true });
		dir = await mkViewer(false);
	});

	it("fallback sem index.html → next (não serve HTML)", async () => {
		const app = mkApp(dir, { apiFallback: true });
		const res = await app.request("/", { headers: { accept: "text/html" } });
		expect(res.status).toBe(401);
		expect(await res.json()).toEqual({ erro: "NAO_AUTORIZADO" });
	});
});
