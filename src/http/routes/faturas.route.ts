/**
 * Rotas de faturas (SPEC-0001 emissão, SPEC-0002 preparação).
 *
 * Rota fina (ADR-0007): valida (Zod), chama domínio/portas (injetadas),
 * serializa. A orquestração de `POST /faturas/preparar` (filtro, cálculo,
 * persistência, rollback) vive em `./preparar.handler` (`executarPreparacao`);
 * a rota só valida o body, chama o handler e devolve `{corpo, status}`.
 *
 * A leitura de domínio e a persistência vivem na `AtacadoPort` (agora com
 * `getFaturaPorId` canônico, A1); o enfileiramento na `QueuePort`.
 *
 * Envelope de erro (CONVENTIONS): `#/http/middlewares/envelope` — `erroResponse`
 * retorna `{corpo, status}`; `HttpError(tipo, mensagem, detalhe?, status?)`.
 */
import { Hono } from "hono";
import { z } from "zod";
import { documentoValido } from "#/domain/fatura/validacao";
import type { Fatura } from "#/domain/types";
import type { AtacadoPort, ErroEmissao } from "#/domain/ports/atacado.port";
import type { QueuePort } from "#/domain/ports/queue.port";
import type { DefaultsFiscais } from "#/domain/fatura/defaults-fiscais";
import {
	TipoErro,
	erroResponse,
} from "#/http/middlewares/envelope";
import { errorHandler } from "#/http/middlewares/error-handler";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { executarPreparacao, type PrepararInput } from "./preparar.handler";

/** Dependências injetadas (o composition root liga os reais). */
export interface FaturasRoutesDeps {
	atacado: AtacadoPort;
	queue: QueuePort;
	/**
	 * Defaults fiscais (CFOP/cClass/ICMS) vindos de `env.FISCAL_*` (ADR-0005). O domínio
	 * não lê env (ADR-0004), então a rota os recebe injetados do composition root e
	 * passa a `calcularFatura`. Opcional com fallback ao padrão provisório (testes de
	 * rotas que não exercitam o cálculo podem omitir).
	 */
	defaultsFiscais?: DefaultsFiscais;
}

const prepararBodySchema = z.object({
	parceiroId: z.number().int().positive(),
	dataReferencia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dataReferencia deve ser YYYY-MM-DD"),
	tipoFaturamento: z.enum(["parceiro", "via-parceiro", "cofaturamento", "cliente-final"]),
});

/** Constrói as rotas de fatura com deps injetadas. */
export function criarFaturasRoutes(deps: FaturasRoutesDeps): Hono {
	const { atacado, queue } = deps;
	const app = new Hono();

	// Reusa o error-handler CANÔNICO (o mesmo montado no app pai em server.ts):
	// HttpError → envelope, ZodError → 422 VALIDACAO, erro genérico → 500, logado
	// uma vez com tipo+status (ADR-0008 §4). Não diverge do handler do pai — é o
	// mesmo; montado no sub-app só para que a rota seja testável isoladamente
	// (sem o app pai) e ainda assim responda o envelope.
	app.onError(errorHandler());

	// ============================================================
	// POST /faturas/preparar (SPEC-0002 — síncrono)
	// ============================================================
	app.post("/faturas/preparar", async (c) => {
		// Valida body (Zod). Caso 8: inválido → 422 VALIDACAO.
		const parsed = prepararBodySchema.safeParse(await c.req.json());
		if (!parsed.success) {
			const { corpo, status } = erroResponse(TipoErro.VALIDACAO, "Body inválido", parsed.error.flatten() as Record<string, unknown>);
			return c.json(corpo, status as ContentfulStatusCode);
		}
		// Delega toda a orquestração ao handler de aplicação (ADR-0007 rota fina).
		const input: PrepararInput = parsed.data;
		const resultado = await executarPreparacao(
			{ atacado, defaultsFiscais: deps.defaultsFiscais },
			input,
		);
		return c.json(resultado.corpo, resultado.status as ContentfulStatusCode);
	});

	// ============================================================
	// POST /faturas/:id/emitir (SPEC-0001 — enfileira, 202)
	// ============================================================
	app.post("/faturas/:id/emitir", async (c) => {
		const id = Number(c.req.param("id"));
		if (!Number.isInteger(id) || id <= 0) {
			const { corpo, status } = erroResponse(TipoErro.VALIDACAO, "id inválido");
			return c.json(corpo, status as ContentfulStatusCode);
		}

		// Carrega a fatura (árvore). Não encontrada → 404.
		const fatura = await carregarFatura(atacado, id);
		if (!fatura) {
			const { corpo, status } = erroResponse(TipoErro.NAO_ENCONTRADO, "Fatura não encontrada");
			return c.json(corpo, status as ContentfulStatusCode);
		}

		// Caso 1: 409 se emitindo/emitida.
		if (fatura.status === "emitindo" || fatura.status === "emitida") {
			const { corpo, status } = erroResponse(TipoErro.CONFLITO, "Emissão já em curso ou concluída");
			return c.json(corpo, status as ContentfulStatusCode);
		}

		// Caso 3: soma das cobranças == total da fatura (até 1 centavo).
		const soma = fatura.cobrancas.reduce((acc, cb) => acc + cb.valorTotal, 0);
		if (Math.abs(soma - fatura.valorTotal) > 1) {
			const { corpo, status } = erroResponse(TipoErro.VALIDACAO, "Soma das cobranças diverge do total da fatura");
			return c.json(corpo, status as ContentfulStatusCode);
		}

		// Caso 4: toda cobrança tem ≥1 nota a-emitir.
		const semNota = fatura.cobrancas.find((cb) => !cb.notas.some((n) => n.statusInterno === "a-emitir"));
		if (semNota) {
			const { corpo, status } = erroResponse(TipoErro.VALIDACAO, "Toda cobrança precisa de nota a-emitir");
			return c.json(corpo, status as ContentfulStatusCode);
		}

		// Caso 8: documentos válidos (destinatários).
		const notas = fatura.cobrancas.flatMap((cb) => cb.notas);
		const docInvalido = notas.find((n) => !documentoValido(n.cpfcnpj));
		if (docInvalido) {
			const { corpo, status } = erroResponse(TipoErro.VALIDACAO, `Documento do destinatário inválido: ${docInvalido.nome}`);
			return c.json(corpo, status as ContentfulStatusCode);
		}

		// Enfileira (não executa síncrono — ADR-0002). C2: enfileira só o id; o
		// worker (B1) carrega a fatura por `getFaturaPorId` — não precisa de
		// parceiroId/dataReferencia aqui.
		const { jobId } = await queue.enfileirarEmissaoFatura(id);
		return c.json({ jobId, statusUrl: `/faturas/${id}/emissao` }, 202);
	});

	// ============================================================
	// GET /faturas/:id/emissao (SPEC-0001 passo 7 — fallback)
	// ============================================================
	app.get("/faturas/:id/emissao", async (c) => {
		const id = Number(c.req.param("id"));
		const fatura = await carregarFatura(atacado, id);
		if (!fatura) {
			const { corpo, status } = erroResponse(TipoErro.NAO_ENCONTRADO, "Fatura não encontrada");
			return c.json(corpo, status as ContentfulStatusCode);
		}
		// Erros de emissão da fatura (SPEC-0001 passo 7) — resolvidos pelos ids de
		// cobrança/nota (t_nfcom_erros não tem FK direta de fatura).
		const cobrancaIds = fatura.cobrancas.map((cb) => cb.id).filter((n): n is number => n != null);
		const notaIds = fatura.cobrancas.flatMap((cb) => cb.notas.map((n) => n.id)).filter((n): n is number => n != null);
		const erros = await atacado.buscarErrosPorFatura(cobrancaIds, notaIds);
		return c.json(serializarEmissao(fatura, erros), 200);
	});

	return app;
}

// ============================================================
// Helpers internos
// ============================================================

/**
 * Carrega a fatura por id. `getFaturaPorId` é canônico na AtacadoPort (A1) — o
 * composition root injeta o repository real que o implementa. C1: sem guard de
 * opcional; a chamada é direta (o método sempre existe na porta).
 */
async function carregarFatura(atacado: AtacadoPort, id: number): Promise<Fatura | null> {
	return atacado.getFaturaPorId(id);
}

/** Resposta de `GET /faturas/:id/emissao` (SPEC-0001 passo 7). */
interface EmissaoNota {
	id?: number;
	situacao?: string;
	chave?: string;
	protocolo?: string;
}
interface EmissaoCobranca {
	id?: number;
	status: string;
	boletoUrl?: string;
	notas: EmissaoNota[];
}
interface EmissaoErro {
	id: number;
	cobrancaId?: number;
	notaId?: number;
	erro: string;
	mensagem: string;
	statusCode?: string;
}
interface EmissaoResponse {
	faturaId?: number;
	status: string;
	cobrancas: EmissaoCobranca[];
	erros: EmissaoErro[];
}

/** Serializa o estado de emissão (GET /emissao). */
function serializarEmissao(fatura: Fatura, erros: ErroEmissao[]): EmissaoResponse {
	return {
		faturaId: fatura.id,
		status: fatura.status,
		cobrancas: fatura.cobrancas.map((cb) => ({
			id: cb.id,
			status: cb.status,
			boletoUrl: cb.linkFatura,
			notas: cb.notas.map((n) => ({
				id: n.id,
				situacao: n.situacao,
				chave: n.chave,
				protocolo: n.protocolo,
			})),
		})),
		erros: erros.map((e) => ({
			id: e.id,
			cobrancaId: e.cobrancaId,
			notaId: e.notaId,
			erro: e.erro,
			mensagem: e.mensagem,
			statusCode: e.statusCode,
		})),
	};
}
