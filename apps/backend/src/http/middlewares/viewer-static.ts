/**
 * src/http/middlewares/viewer-static.ts — serve os estáticos do viewer (SPA)
 * a partir do próprio backend Hono, no MESMO origin do `/painel`.
 *
 * Por que mesmo origin: o cookie de sessão do painel (`painel_sess`) é
 * `HttpOnly`, `SameSite=Lax`, `path=/`. Servir o viewer noutro origin exigiria
 * CORS + `SameSite=None; Secure` (infra extra). Mesmo origin via proxy é o que
 * o `vite.config.ts` já faz em dev (proxy `/painel` → :3000); este middleware
 * replica isso em produção (estáticos servidos pelo próprio backend Bun).
 *
 * Rotas do SPA (`/`, `/login`, `/faturas/:id`, `/parceiros/...`, `/emitir`,
 * `/filas`) NÃO colidem com as rotas de API (`/health`, `/painel/*`,
 * `/faturas/preparar`, `/faturas/:id/emitir`, `/faturas/:id/emissao`).
 * Diferenciação: chamadas `fetch` do viewer mandam `Accept: application/json`;
 * navegação do browser manda `Accept: text/html`. O fallback serve `index.html`
 * só quando há `text/html` no Accept — assim `GET /faturas/123` (SPA) cai no
 * fallback, mas `GET /faturas/123/emissao` (API, Accept json) passa adiante
 * → apiKeyMiddleware → rota de API.
 *
 ** Opcional: `viewerDist` ausente → nada é montado (o app segue como antes,
 * sem servir o viewer — não quebra o deploy sem o build do viewer).
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { MiddlewareHandler } from "hono";
import { serveStatic } from "hono/bun";

/**
 * Prefixos reservados à API/infra — o fallback NUNCA serve `index.html` para
 * eles, mesmo com `Accept: text/html`. Evita mascarar erro de API como 200 HTML.
 *
 * `/faturas` NÃO entra aqui de propósito: o SPA usa a rota de cliente
 * `/faturas/:id`. A diferenciação entre SPA e API em `/faturas/...` é só pelo
 * `Accept` (a API `/faturas/:id/emissao`, `/faturas/preparar` etc. é chamada via
 * `fetch` com `Accept: application/json`, nunca navegada pelo browser).
 */
const PREFIXOS_RESERVADOS = ["/health", "/painel", "/webhook"];

function ehPathReservado(pathname: string): boolean {
	return PREFIXOS_RESERVADOS.some(
		(p) => pathname === p || pathname.startsWith(`${p}/`),
	);
}

function aceitaHtml(accept: string | undefined): boolean {
	return Boolean(accept?.includes("text/html"));
}

export interface ViewerStaticOptions {
	/** Path absoluto do diretório `dist` do viewer buildado (Vite). */
	viewerDist: string;
}

/**
 * Cria os handlers de estáticos do viewer:
 * - `assetsHandler`: serve arquivos de `/assets/*` (no filesystem `dist/assets`).
 * - `spaFallback`: serve `index.html` para navegação HTML (SPA routing), exceto
 *   em paths reservados à API.
 *
 * Devem ser montados **antes** do `apiKeyMiddleware` (rotas de SPA sejam
 * públicas; a auth real do painel é o cookie `/painel`).
 */
export function criarViewerStatic({ viewerDist }: ViewerStaticOptions) {
	/**
	 * `serveStatic` resolve `${root}/${pathname}` no filesystem, preservando o
	 * segmento `/assets`. Montado em `GET /assets/*`, ele lê
	 * `${viewerDist}/assets/<resto>` — por isso `root = viewerDist` (não o
	 * subdir `assets`, que duplicaria o segmento).
	 */
	const assetsHandler = serveStatic({ root: viewerDist });

	// Cacheia o `index.html` (lê uma vez por cold start) p/ o fallback não custar
	// um I/O por navegação. Re-lê só se inconsistente é desnecessário — o build é
	// imutável por deploy.
	let indexHtml: Buffer | null = null;
	let indexCarregado = false;

	async function lerIndex(): Promise<Buffer | null> {
		if (indexCarregado) return indexHtml;
		indexCarregado = true;
		const idx = join(viewerDist, "index.html");
		try {
			indexHtml = await readFile(idx);
			return indexHtml;
		} catch {
			return null;
		}
	}

	const spaFallback: MiddlewareHandler = async (c, next) => {
		// Só responde a GET com Accept: text/html (navegação). `fetch` do viewer
		// manda `Accept: application/json` → passa adiante p/ a rota de API.
		if (c.req.method !== "GET" || !aceitaHtml(c.req.header("accept"))) {
			return next();
		}
		const pathname = new URL(c.req.url).pathname;
		if (ehPathReservado(pathname)) {
			return next();
		}
		const html = await lerIndex();
		if (!html) return next();
		return c.html(html.toString("utf8"), 200);
	};

	return { assetsHandler, spaFallback };
}
