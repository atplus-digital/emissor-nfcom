/**
 * Rotas de dados do painel de visualização de faturas/notas.
 *
 * Leitura da fonte de domínio (Atacado) com filtros opcionais + parceiros/
 * clientes e emissão (preparar + emitir); autenticação via sessão do cookie
 * `painel_sess` (middleware em todas as rotas — rotas de dados SEMPRE exigem
 * sessão válida — sem API key no browser). O `serializar*` (UI) converte
 * centavos → reais e documento limpo → mascarado (fronteira de UI, ADR-0004).
 *
 * Envelope de erro (CONVENTIONS): `erroResponse` → `{corpo, status}`.
 */
import { Hono } from "hono";
import { z } from "zod";
import type { AtacadoPort, FiltroClientes, FiltroFaturas } from "#/domain/ports/atacado.port";
import type { QueuePort } from "#/domain/ports/queue.port";
import type { DefaultsFiscais } from "#/domain/fatura/defaults-fiscais";
import {
	TipoErro,
	erroResponse,
} from "#/http/middlewares/envelope";
import { errorHandler } from "#/http/middlewares/error-handler";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { PainelSession } from "#/http/middlewares/painel-session";
import { prepararBodySchema } from "./faturas.route";
import { emitirFatura } from "./emitir.handler";
import { executarPreparacao, type PrepararInput } from "./preparar.handler";
import {
	serializarClienteListaPaginada,
	serializarEmissaoPainel,
	serializarFaturaDetalhe,
	serializarFaturaLista,
	serializarParceiroDetalhe,
	serializarParceiroLista,
	serializarPreparo,
	type PreparoCru,
} from "./painel-serialize";

/** Dependências injetadas (o composition root liga os reais). */
export interface PainelDataDeps {
	atacado: AtacadoPort;
	session: PainelSession;
	/** Fila BullMQ p/ o `POST /api/faturas/:id/emitir` (enfileira, 202). */
	queue: QueuePort;
	/** Defaults fiscais p/ o cálculo do preparo (idem rotas API-key). */
	defaultsFiscais?: DefaultsFiscais;
	/** Fallback de IE p/ destinatário isento (idem rotas API-key, Defeito B). */
	ieIsento?: string;
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

/**
 * Query params de `GET /api/parceiros/:id/clientes` — paginação + filtros,
 * todos opcionais (defaults: página 1, 20 itens). `uf` é o estado (2 letras);
 * `cpfcnpj` aceita dígitos ou mascarado (o módulo normaliza).
 */
const clientesQuerySchema = z.object({
	page: z.coerce.number().int().min(1).optional(),
	pageSize: z.coerce.number().int().min(1).max(100).optional(),
	busca: z.string().trim().min(1).max(120).optional(),
	cpfcnpj: z.string().trim().min(1).max(30).optional(),
	cidade: z.string().trim().min(1).max(80).optional(),
	uf: z
		.string()
		.trim()
		.length(2, "uf deve ter 2 letras")
		.optional(),
});

/** Constrói as rotas de dados do painel com deps injetadas. */
export function criarPainelDataRoutes(deps: PainelDataDeps): Hono {
	const { atacado, session, queue } = deps;
	const app = new Hono();

	// Sessão em TODAS as rotas de dados — sem cookie válido → 401 envelope.
	app.use("*", session.middleware);

	// Mesmo error-handler canônico das rotas de fatura (mesmo handler do app
	// pai em server.ts) — montado no sub-app p/ testabilidade isolada.
	app.onError(errorHandler());

	// ============================================================
	// GET /api/parceiros (lista p/ seletor de nova fatura)
	// ============================================================
	app.get("/api/parceiros", async (c) => {
		const resumos = await atacado.listarParceiros();
		return c.json(serializarParceiroLista(resumos), 200);
	});

	// ============================================================
	// GET /api/parceiros/:id (detalhe)
	// ============================================================
	app.get("/api/parceiros/:id", async (c) => {
		const id = Number(c.req.param("id"));
		if (!Number.isInteger(id) || id <= 0) {
			const { corpo, status } = erroResponse(TipoErro.VALIDACAO, "id inválido");
			return c.json(corpo, status as ContentfulStatusCode);
		}
		const parceiro = await atacado.buscarParceiroPorId(id);
		if (!parceiro) {
			const { corpo, status } = erroResponse(
				TipoErro.NAO_ENCONTRADO,
				"Parceiro não encontrado",
			);
			return c.json(corpo, status as ContentfulStatusCode);
		}
		return c.json(serializarParceiroDetalhe(parceiro), 200);
	});

	// ============================================================
	// GET /api/parceiros/:id/clientes (clientes do parceiro — paginado
	// com filtros opcionais; envelope { itens, total, page, pageSize,
	// totalPaginas })
	// ============================================================
	app.get("/api/parceiros/:id/clientes", async (c) => {
		const id = Number(c.req.param("id"));
		if (!Number.isInteger(id) || id <= 0) {
			const { corpo, status } = erroResponse(TipoErro.VALIDACAO, "id inválido");
			return c.json(corpo, status as ContentfulStatusCode);
		}
		const parsed = clientesQuerySchema.safeParse(c.req.query());
		if (!parsed.success) {
			const { corpo, status } = erroResponse(
				TipoErro.VALIDACAO,
				"Query inválida",
				parsed.error.flatten() as Record<string, unknown>,
			);
			return c.json(corpo, status as ContentfulStatusCode);
		}
		const q = parsed.data;
		const page = q.page ?? 1;
		const pageSize = q.pageSize ?? 20;
		// Só os campos presentes — o filtro ausente não filtra no NocoBase.
		const filtro: FiltroClientes = {};
		if (q.busca) filtro.busca = q.busca;
		if (q.cpfcnpj) filtro.cpfcnpj = q.cpfcnpj;
		if (q.cidade) filtro.cidade = q.cidade;
		if (q.uf) filtro.uf = q.uf;
		const { itens, total } = await atacado.listarClientesParceiro(id, filtro, {
			page,
			pageSize,
		});
		return c.json(
			serializarClienteListaPaginada(itens, { total, page, pageSize }),
			200,
		);
	});

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

	// ============================================================
	// POST /api/faturas/preparar (SPEC-0002 — mesmo handler da API key)
	// ============================================================
	app.post("/api/faturas/preparar", async (c) => {
		// Mesmo schema de faturas.route.ts (export compartilhado — sem divergência).
		const parsed = prepararBodySchema.safeParse(await c.req.json());
		if (!parsed.success) {
			const { corpo, status } = erroResponse(
				TipoErro.VALIDACAO,
				"Body inválido",
				parsed.error.flatten() as Record<string, unknown>,
			);
			return c.json(corpo, status as ContentfulStatusCode);
		}
		// Delega toda a orquestração ao handler de aplicação (ADR-0007 rota
		// fina) — o mesmo da rota de API key.
		const input: PrepararInput = parsed.data;
		const resultado = await executarPreparacao(
			{ atacado, defaultsFiscais: deps.defaultsFiscais, ieIsento: deps.ieIsento },
			input,
		);
		// O handler responde em centavos + docs limpos (serializarFatura) —
		// converte p/ o formato do painel (reais + mascarado) na fronteira de
		// UI. Em erro o corpo já É o envelope de erro — repassar sem serializar.
		if (resultado.status >= 400) {
			return c.json(resultado.corpo, resultado.status as ContentfulStatusCode);
		}
		return c.json(serializarPreparo(resultado.corpo as PreparoCru), resultado.status as ContentfulStatusCode);
	});

	// ============================================================
	// POST /api/faturas/:id/emitir (SPEC-0001 — enfileira, 202)
	// ============================================================
	app.post("/api/faturas/:id/emitir", async (c) => {
		const id = Number(c.req.param("id"));
		if (!Number.isInteger(id) || id <= 0) {
			const { corpo, status } = erroResponse(TipoErro.VALIDACAO, "id inválido");
			return c.json(corpo, status as ContentfulStatusCode);
		}
		// Mesmo helper compartilhado da rota de API key (gating + enfileira).
		const resultado = await emitirFatura(atacado, queue, id);
		return c.json(resultado.corpo, resultado.status as ContentfulStatusCode);
	});

	return app;
}
