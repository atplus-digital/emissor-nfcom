/**
 * Rotas de dados do painel de visualização de faturas/notas.
 *
 * Leitura da fonte de domínio (Atacado) com filtros opcionais; autenticação
 * via sessão do cookie `painel_sess` (middleware em todas as rotas — rotas de
 * dados SEMPRE exigem sessão válida). O `serializar*` (UI) converte centavos →
 * reais e documento limpo → mascarado (fronteira de UI, ADR-0004).
 *
 * Envelope de erro (CONVENTIONS): `erroResponse` → `{corpo, status}`.
 */
import { Hono } from "hono";
import { z } from "zod";
import type { AtacadoPort, FiltroFaturas } from "#/domain/ports/atacado.port";
import {
	TipoErro,
	erroResponse,
} from "#/http/middlewares/envelope";
import { errorHandler } from "#/http/middlewares/error-handler";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { PainelSession } from "#/http/middlewares/painel-session";
import {
	serializarEmissaoPainel,
	serializarFaturaDetalhe,
	serializarFaturaLista,
} from "./painel-serialize";

/** Dependências injetadas (o composition root liga os reais). */
export interface PainelDataDeps {
	atacado: AtacadoPort;
	session: PainelSession;
}

/**
 * Query params de `GET /api/faturas` — todos opcionais. `status` restringe ao
 * enum do domínio (Zod) e vira o `FiltroFaturas`.
 */
const listQuerySchema = z.object({
	parceiroId: z.coerce.number().int().positive().optional(),
	dataReferencia: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/, "dataReferencia deve ser YYYY-MM-DD")
		.optional(),
	status: z
		.enum(["a-emitir", "emitindo", "emitida", "parcial", "erro", "pago", "cancelada"])
		.optional(),
});

/** Constrói as rotas de dados do painel com deps injetadas. */
export function criarPainelDataRoutes(deps: PainelDataDeps): Hono {
	const { atacado, session } = deps;
	const app = new Hono();

	// Sessão em TODAS as rotas de dados — sem cookie válido → 401 envelope.
	app.use("*", session.middleware);

	// Mesmo error-handler canônico das rotas de fatura (mesmo handler do app
	// pai em server.ts) — montado no sub-app p/ testabilidade isolada.
	app.onError(errorHandler());

	// ============================================================
	// GET /api/faturas (listagem com filtros opcionais)
	// ============================================================
	app.get("/api/faturas", async (c) => {
		const raw = c.req.query();
		const parsed = listQuerySchema.safeParse(raw);
		if (!parsed.success) {
			const { corpo, status } = erroResponse(
				TipoErro.VALIDACAO,
				"Query inválida",
				parsed.error.flatten() as Record<string, unknown>,
			);
			return c.json(corpo, status as ContentfulStatusCode);
		}
		const resumos = await atacado.listarFaturas(parsed.data);
		return c.json(serializarFaturaLista(resumos), 200);
	});

	// ============================================================
	// GET /api/faturas/:id (detalhe com a árvore)
	// ============================================================
	app.get("/api/faturas/:id", async (c) => {
		const id = Number(c.req.param("id"));
		if (!Number.isInteger(id) || id <= 0) {
			const { corpo, status } = erroResponse(TipoErro.VALIDACAO, "id inválido");
			return c.json(corpo, status as ContentfulStatusCode);
		}
		const fatura = await atacado.getFaturaPorId(id);
		if (!fatura) {
			const { corpo, status } = erroResponse(
				TipoErro.NAO_ENCONTRADO,
				"Fatura não encontrada",
			);
			return c.json(corpo, status as ContentfulStatusCode);
		}
		return c.json(serializarFaturaDetalhe(fatura), 200);
	});

	// ============================================================
	// GET /api/faturas/:id/emissao (estado de emissão)
	// ============================================================
	app.get("/api/faturas/:id/emissao", async (c) => {
		const id = Number(c.req.param("id"));
		if (!Number.isInteger(id) || id <= 0) {
			const { corpo, status } = erroResponse(TipoErro.VALIDACAO, "id inválido");
			return c.json(corpo, status as ContentfulStatusCode);
		}
		const fatura = await atacado.getFaturaPorId(id);
		if (!fatura) {
			const { corpo, status } = erroResponse(
				TipoErro.NAO_ENCONTRADO,
				"Fatura não encontrada",
			);
			return c.json(corpo, status as ContentfulStatusCode);
		}
		// Erros resolvidos pelos ids de cobrança/nota da árvore (mesma regra de
		// faturas.route.ts — t_nfcom_erros não tem FK direta de fatura).
		const cobrancaIds = fatura.cobrancas.map((cb) => cb.id).filter((n): n is number => n != null);
		const notaIds = fatura.cobrancas.flatMap((cb) => cb.notas.map((n) => n.id)).filter((n): n is number => n != null);
		const erros = await atacado.buscarErrosPorFatura(cobrancaIds, notaIds);
		return c.json(serializarEmissaoPainel(fatura, erros), 200);
	});

	return app;
}
