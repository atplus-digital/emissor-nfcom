/**
 * Rotas de faturas (SPEC-0001 emissão, SPEC-0002 preparação).
 *
 * Rota fina (ADR-0007): valida (Zod), chama domínio/portas (injetadas),
 * serializa. Sem lógica de negócio aqui — o cálculo e a validação de domínio
 * vivem em `#/domain/fatura/*`; a persistência/leitura na `AtacadoPort`;
 * o enfileiramento na `QueuePort`.
 *
 * Envelope de erro (CONVENTIONS): `#/http/middlewares/envelope` — `erroResponse`
 * retorna `{corpo, status}`; `HttpError(tipo, mensagem, detalhe?, status?)`.
 */
import { Hono } from "hono";
import { z } from "zod";
import { calcularFatura } from "#/domain/fatura/calculo";
import { normalizarDataReferencia } from "#/domain/fatura/normalizacao";
import {
	validarDocumentos,
	validarEnderecoDestinatario,
	documentoValido,
} from "#/domain/fatura/validacao";
import type { DefaultsFiscais } from "#/domain/fatura/defaults-fiscais";
import { DEFAULTS_FISCAIS_PADRAO } from "#/domain/fatura/defaults-fiscais";
import type { Fatura } from "#/domain/types";
import type { AtacadoPort } from "#/domain/ports/atacado.port";
import type { QueuePort } from "#/domain/ports/queue.port";
import {
	TipoErro,
	erroResponse,
} from "#/http/middlewares/envelope";
import { errorHandler } from "#/http/middlewares/error-handler";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { log } from "#/lib/logger";

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

/**
 * Extensão opcional da AtacadoPort para leitura por id (GET /emissao, POST
 * /emitir). O contrato canônico da AtacadoPort tem só buscarFaturaPorChave;
 * a leitura por id é adicionada pelo composition root (Fase 6) — a rota a usa
 * se presente. Testes injetam via este campo.
 */
type AtacadoComLeitura = AtacadoPort & {
	getFaturaPorId?: (id: number) => Promise<Fatura | null>;
};

const prepararBodySchema = z.object({
	parceiroId: z.number().int().positive(),
	dataReferencia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dataReferencia deve ser YYYY-MM-DD"),
	tipoFaturamento: z.enum(["parceiro", "via-parceiro", "cofaturamento", "cliente-final"]),
});

/** Status que já entraram na emissão — re-preparo recusado (casos 5/14). */
const STATUS_EM_EMISSAO: Fatura["status"][] = ["emitindo", "emitida", "parcial", "erro"];
const STATUS_FORA_CICLO: Fatura["status"][] = ["pago", "cancelada"];

/** Constrói as rotas de fatura com deps injetadas. */
export function criarFaturasRoutes(deps: FaturasRoutesDeps): Hono {
	const atacado = deps.atacado as AtacadoComLeitura;
	const queue = deps.queue;
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
		// Passo 1: valida body (Zod). Caso 8: inválido → 422 VALIDACAO.
		const parsed = prepararBodySchema.safeParse(await c.req.json());
		if (!parsed.success) {
			const { corpo, status } = erroResponse(TipoErro.VALIDACAO, "Body inválido", parsed.error.flatten() as Record<string, unknown>);
			return c.json(corpo, status as ContentfulStatusCode);
		}
		const { parceiroId, dataReferencia, tipoFaturamento } = parsed.data;
		const refNorm = normalizarDataReferencia(dataReferencia);

		// Passo 2: resolução de existente (idempotência por chave natural).
		const existente = await atacado.buscarFaturaPorChave(parceiroId, refNorm);
		let modo: "criacao" | "atualizacao" = "criacao";
		if (existente) {
			if (STATUS_EM_EMISSAO.includes(existente.status) || STATUS_FORA_CICLO.includes(existente.status)) {
				// Casos 5/14: fatura já entrou na emissão ou está fora do ciclo.
				const { corpo, status } = erroResponse(TipoErro.CONFLITO, "Fatura já entrou na emissão ou está fora do ciclo de emissão");
				return c.json(corpo, status as ContentfulStatusCode);
			}
			// existe e status a-emitir → atualização (caso 6).
			modo = "atualizacao";
			await atacado.removerArvore(existente.id!);
		}

		// Passo 3: leitura de domínio em paralelo.
		const [parceiro, clientes, planos] = await Promise.all([
			atacado.buscarParceiroPorId(parceiroId),
			atacado.buscarClientesAtivosPorParceiro(parceiroId),
			atacado.buscarPlanosDeServico(),
		]);

		// Passo 4: validação pré-persistência.
		// Caso 1: parceiro não encontrado.
		if (!parceiro) {
			const { corpo, status } = erroResponse(TipoErro.VALIDACAO, "Parceiro não encontrado");
			return c.json(corpo, status as ContentfulStatusCode);
		}
		// Caso 3: planos inexistentes (antes do filtro de linhas — sem planos, o
		// filtro descarta todos os clientes e mascararia o erro de planos).
		if (planos.length === 0) {
			const { corpo, status } = erroResponse(TipoErro.VALIDACAO, "Planos de serviço não encontrados");
			return c.json(corpo, status as ContentfulStatusCode);
		}
		// Caso 2: nenhum cliente ativo com linhas válidas.
		const planoById = new Map(planos.map((p) => [p.id, p]));
		const clientesComLinhas = clientes
			.map((cli) => ({ ...cli, linhas: cli.linhas.filter((l) => planoById.has(l.planoId) && l.unitario > 0) }))
			.filter((cli) => cli.linhas.length > 0);
		if (clientesComLinhas.length === 0) {
			const { corpo, status } = erroResponse(TipoErro.VALIDACAO, "Nenhum cliente com linhas ativas encontrado para faturamento");
			return c.json(corpo, status as ContentfulStatusCode);
		}

		// Passo 5: cálculo (domínio puro).
		const { fatura, erros: errosCalc } = calcularFatura(parceiro, clientes, planos, refNorm, tipoFaturamento, deps.defaultsFiscais ?? DEFAULTS_FISCAIS_PADRAO);
		if (errosCalc.length > 0) {
			const { corpo, status } = erroResponse(TipoErro.VALIDACAO, errosCalc[0]?.mensagem ?? "Erro de calculo", { erros: errosCalc });
			return c.json(corpo, status as ContentfulStatusCode);
		}

		// Validação de documentos (caso 4) e endereço (caso 13) sobre as notas da fatura calculada.
		const todasNotas = fatura.cobrancas.flatMap((cb) => cb.notas);
		const errosDoc = validarDocumentos(parceiro, todasNotas, clientesComLinhas);
		if (errosDoc.length > 0) {
			const { corpo, status } = erroResponse(TipoErro.VALIDACAO, errosDoc[0]?.mensagem ?? "Documento invalido", { erros: errosDoc });
			return c.json(corpo, status as ContentfulStatusCode);
		}
		const errosEnd = validarEnderecoDestinatario(todasNotas);
		if (errosEnd.length > 0) {
			const { corpo, status } = erroResponse(TipoErro.VALIDACAO, errosEnd[0]?.mensagem ?? "Endereco do destinatario incompleto", { erros: errosEnd });
			return c.json(corpo, status as ContentfulStatusCode);
		}

		// Passo 7: persistência direta com rollback manual (SPEC-0002 caso 7).
		let faturaId: number;
		if (modo === "atualizacao") {
			faturaId = existente!.id!;
		} else {
			const criada = await atacado.criarFatura({
				parceiroId,
				dataReferencia: fatura.dataReferencia,
				dataVencimento: fatura.dataVencimento,
				valorTotal: fatura.valorTotal,
				tipoFaturamento,
				status: "a-emitir",
			});
			faturaId = criada.id;
		}

		try {
			for (const cb of fatura.cobrancas) {
				const cobranca = await atacado.criarCobranca(faturaId, {
					valorTotal: cb.valorTotal,
					nomeDevedor: cb.nomeDevedor,
					documentoDevedor: cb.documentoDevedor,
					emailDevedor: cb.emailDevedor,
					status: "a-emitir",
					dataVencimento: cb.dataVencimento,
				});
				cb.id = cobranca.id;
				for (const nota of cb.notas) {
					const notaCriada = await atacado.criarNota(cobranca.id, {
						nome: nota.nome,
						cpfcnpj: nota.cpfcnpj,
						email: nota.email,
						endereco: nota.endereco,
						rgie: nota.rgie,
						telefone: nota.telefone,
						uf: nota.uf,
						cidade: nota.cidade,
						statusInterno: "a-emitir",
						total: nota.total,
					});
					nota.id = notaCriada.id;
					nota.cobrancaId = cobranca.id;
					for (const item of nota.itens) {
						await atacado.criarItem(notaCriada.id, {
							codigo: item.codigo,
							descricao: item.descricao,
							cfop: item.cfop,
							cclass: item.cclass,
							quantidade: item.quantidade,
							unitario: item.unitario,
							total: item.total,
							aliqIcms: item.aliqIcms,
							bcIcms: item.bcIcms,
							icms: item.icms,
							incideAliquota: item.incideAliquota,
						});
					}
				}
			}
		} catch (err) {
			// Caso 7: rollback manual estrito (criação aborta e remove a árvore).
			log.error({ err, faturaId }, "falha na persistência da árvore — rollback");
			await atacado.removerArvore(faturaId);
			const { corpo, status } = erroResponse(TipoErro.ERRO_INTERNO, "Falha ao persistir a árvore da fatura");
			return c.json(corpo, status as ContentfulStatusCode);
		}

		// Passo 8: resposta 201 (criação) / 200 (atualização) com a árvore (IDs reais).
		const resposta = serializarFatura(fatura, faturaId);
		return c.json(resposta, modo === "criacao" ? 201 : 200);
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

		// Enfileira (não executa síncrono — ADR-0002).
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
		return c.json(serializarEmissao(fatura), 200);
	});

	return app;
}

// ============================================================
// Helpers internos
// ============================================================

/**
 * Carrega a fatura por id. A AtacadoPort canônica tem buscarFaturaPorChave
 * (chave natural); a leitura por id é uma extensão opcional (`getFaturaPorId`)
 * injetada pelo composition root (Fase 6). Sem ela, retorna null — os testes
 * injetam a extensão.
 */
async function carregarFatura(atacado: AtacadoComLeitura, id: number): Promise<Fatura | null> {
	if (typeof atacado.getFaturaPorId === "function") {
		return atacado.getFaturaPorId(id);
	}
	return null;
}

/** Serializa a fatura criada/atualizada para a resposta (domínio → JSON, IDs reais). */
function serializarFatura(fatura: Fatura, faturaId: number): unknown {
	return {
		faturaId,
		status: fatura.status,
		dataReferencia: fatura.dataReferencia,
		dataVencimento: fatura.dataVencimento,
		valorTotal: fatura.valorTotal,
		tipoFaturamento: fatura.tipoFaturamento,
		cobrancas: fatura.cobrancas.map((cb) => ({
			id: cb.id,
			valorTotal: cb.valorTotal,
			nomeDevedor: cb.nomeDevedor,
			documentoDevedor: cb.documentoDevedor,
			emailDevedor: cb.emailDevedor,
			status: cb.status,
			notas: cb.notas.map((n) => ({
				id: n.id,
				nome: n.nome,
				cpfcnpj: n.cpfcnpj,
				endereco: n.endereco,
				cobrancaId: cb.id,
				status: n.statusInterno,
			})),
		})),
	};
}

/** Serializa o estado de emissão (GET /emissao). */
function serializarEmissao(fatura: Fatura): unknown {
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
		erros: [],
	};
}
