/**
 * Handler de aplicação de `POST /faturas/preparar` (SPEC-0002 — síncrono).
 *
 * Extraído da rota (ADR-0007 rota fina): aqui vive toda a orquestração de
 * preparação — resolução de existente (idempotência por chave natural), gating
 * de status, leitura de domínio, validação pré-persistência (casos 1-4, 13),
 * cálculo, persistência direta com rollback manual (caso 7). A rota apenas
 * valida o body (Zod) → chama `executarPreparacao` → serializa o resultado.
 *
 * O parâmetro `input` já veio validado pelo Zod da rota; esta função assume
 * shape correto (parceiroId inteiro > 0, dataReferencia YYYY-MM-DD,
 * tipoFaturamento no enum).
 */
import { calcularFatura } from "#/domain/fatura/calculo";
import { montarDescricaoCobranca } from "#/domain/fatura/descricao";
import { normalizarDataReferencia } from "#/domain/fatura/normalizacao";
import {
	validarDocumentos,
	validarEnderecoDestinatario,
} from "#/domain/fatura/validacao";
import { normalizarIE } from "#/domain/fiscal/ie";
import type { DefaultsFiscais } from "#/domain/fatura/defaults-fiscais";
import { DEFAULTS_FISCAIS_PADRAO } from "#/domain/fatura/defaults-fiscais";
import type { ErroValidacao, Fatura } from "#/domain/types";
import type { AtacadoPort } from "#/domain/ports/atacado.port";
import {
	TipoErro,
	erroResponse,
} from "#/http/middlewares/envelope";
import { log } from "#/lib/logger";

/** Status que já entraram na emissão — re-preparo recusado (casos 5/14). */
const STATUS_EM_EMISSAO: Fatura["status"][] = ["emitindo", "emitida", "parcial", "erro"];
const STATUS_FORA_CICLO: Fatura["status"][] = ["pago", "cancelada"];

/** Input já validado pelo Zod da rota. */
export interface PrepararInput {
	parceiroId: number;
	dataReferencia: string;
	tipoFaturamento: Fatura["tipoFaturamento"];
}

/** Dependências de aplicação injetadas pela rota (composition root). */
export interface PrepararDeps {
	atacado: AtacadoPort;
	defaultsFiscais?: DefaultsFiscais;
	/**
	 * Fallback de IE p/ destinatário isento (`env.FISCAL_IE_ISENTO`, ligado pelo
	 * composition root). Defeito B: no tipo `parceiro` o destinatário da nota é o
	 * próprio parceiro — se ele não tem IE numérica (f_ie="ISENTO"/vazio) e não
	 * há fallback, a emissão falharia no worker com `IE do Destinatário não
	 * informada`. A validação é antecipada aqui (fail-fast) para não criar
	 * boletos só para rejeitar na NFCom. O handler não lê env diretamente.
	 */
	ieIsento?: string;
}

/** Resultado: corpo do envelope + status HTTP (1xx-2xx sucesso, 4xx/5xx erro). */
export interface PrepararResultado {
	corpo: unknown;
	status: number;
}

/**
 * Classifica os erros de cálculo (M10, SPEC-0002 caso 11).
 *
 * A maioria dos erros de cálculo é validação de domínio (clientes/planos) → 422
 * VALIDACAO. A divergência de soma entre cobranças/notas e o total da fatura é
 * um erro interno de cálculo — não deveria ocorrer (o cálculo é determinístico)
 * — e a spec manda tratá-lo como 500 ERRO_INTERNO defensivo.
 *
 * A distinção usa o discriminador `ErroValidacao.codigo` (`SOMA_DIVERGENTE`),
 * definido pelo `calculo.ts` — não por substring da mensagem.
 */
export function classificarErrosCalculo(erros: ErroValidacao[]): { status: number; tipo: TipoErro } {
	// Classificação pelo discriminador estável `codigo` (calculo.ts) — divergência
	// de soma é inconsistência interna (500); demais erros de cálculo → validação
	// (422). A mensagem é texto de exibição e não participa da decisão.
	if (erros.some((e) => e.codigo === "SOMA_DIVERGENTE")) {
		return { status: 500, tipo: TipoErro.ERRO_INTERNO };
	}
	return { status: 422, tipo: TipoErro.VALIDACAO };
}

/** Monta o envelope e o status de um erro (resp. erro vendendo no corpo+status). */
function erroResultado(tipo: TipoErro, mensagem: string, detalhe?: unknown, status?: number): PrepararResultado {
	const { corpo, status: s } = erroResponse(tipo, mensagem, (detalhe ?? {}) as Record<string, unknown>, status);
	return { corpo, status: s };
}

/**
 * Executa a preparação de uma fatura (SPEC-0002). Retorna o corpo + status a
 * responder; a rota só serializa. Não lança para fluxos de domínio esperados —
 * cada caso mapeia para seu envelope. Persistência direta com rollback manual.
 */
export async function executarPreparacao(
	deps: PrepararDeps,
	input: PrepararInput,
): Promise<PrepararResultado> {
	const { atacado, ieIsento } = deps;
	const { parceiroId, dataReferencia, tipoFaturamento } = input;
	const refNorm = normalizarDataReferencia(dataReferencia);

	// Passo 2: resolução de existente (idempotência por chave natural).
	const existente = await atacado.buscarFaturaPorChave(parceiroId, refNorm);
	let modo: "criacao" | "atualizacao" = "criacao";
	if (existente) {
		if (STATUS_EM_EMISSAO.includes(existente.status) || STATUS_FORA_CICLO.includes(existente.status)) {
			// Casos 5/14: fatura já entrou na emissão ou está fora do ciclo.
			return erroResultado(TipoErro.CONFLITO, "Fatura já entrou na emissão ou está fora do ciclo de emissão");
		}
		// existe e status a-emitir → atualização (caso 6). A árvore antiga NÃO é
		// removida ainda (m13): só após passar em todas as validações, para que um
		// re-POST inválido preserve a árvore existente.
		modo = "atualizacao";
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
		return erroResultado(TipoErro.VALIDACAO, "Parceiro não encontrado");
	}
	// Defeito B: tipo `parceiro` → o destinatário da nota é o próprio parceiro.
	// Se ele não tem IE numérica (f_ie="ISENTO"/vazio) e não há fallback
	// (`FISCAL_IE_ISENTO`), a emissão rejeitaria no worker — falha cedo aqui (422)
	// sem criar boletos. Tipos com destinatário=cliente (CPF, sem IE) não chegam.
	if (tipoFaturamento === "parceiro" && normalizarIE(parceiro.ie) === undefined && ieIsento === undefined) {
		return erroResultado(
			TipoErro.VALIDACAO,
			"Parceiro sem IE válida (IE isenta) para faturamento do tipo parceiro — configure FISCAL_IE_ISENTO ou corrija a IE do parceiro",
		);
	}
	// Caso 3: planos inexistentes (antes do filtro de linhas — sem planos, o
	// filtro descarta todos os clientes e mascararia o erro de planos).
	if (planos.length === 0) {
		return erroResultado(TipoErro.VALIDACAO, "Planos de serviço não encontrados");
	}
	// Caso 2: nenhum cliente ativo com linhas válidas.
	const planoById = new Map(planos.map((p) => [p.id, p]));
	const clientesComLinhas = clientes
		.map((cli) => ({ ...cli, linhas: cli.linhas.filter((l) => planoById.has(l.planoId) && l.unitario > 0) }))
		.filter((cli) => cli.linhas.length > 0);
	if (clientesComLinhas.length === 0) {
		return erroResultado(TipoErro.VALIDACAO, "Nenhum cliente com linhas ativas encontrado para faturamento");
	}

	// Passo 5: cálculo (domínio puro).
	const { fatura, erros: errosCalc } = calcularFatura(
		parceiro,
		clientes,
		planos,
		refNorm,
		tipoFaturamento,
		deps.defaultsFiscais ?? DEFAULTS_FISCAIS_PADRAO,
	);
	if (errosCalc.length > 0) {
		// M10: divergência de soma → 500 ERRO_INTERNO; demais erros de cálculo → 422.
		const cls = classificarErrosCalculo(errosCalc);
		return erroResultado(cls.tipo, errosCalc[0]?.mensagem ?? "Erro de calculo", { erros: errosCalc }, cls.status);
	}

	// Validação de documentos (caso 4) e endereço (caso 13) sobre as notas da fatura calculada.
	const todasNotas = fatura.cobrancas.flatMap((cb) => cb.notas);
	const errosDoc = validarDocumentos(parceiro, todasNotas, clientesComLinhas);
	if (errosDoc.length > 0) {
		return erroResultado(TipoErro.VALIDACAO, errosDoc[0]?.mensagem ?? "Documento invalido", { erros: errosDoc });
	}
	const errosEnd = validarEnderecoDestinatario(todasNotas);
	if (errosEnd.length > 0) {
		return erroResultado(TipoErro.VALIDACAO, errosEnd[0]?.mensagem ?? "Endereco do destinatario incompleto", { erros: errosEnd });
	}

	// m13: só aqui — após TODAS as validações passarem — remove-se a árvore antiga
	// num re-POST (atualização), para que um input inválido preserve a árvore.
	if (modo === "atualizacao") {
		await atacado.removerArvore(existente!.id!);
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
			// `f_descricao` obrigatória no CRM — derivada dos itens das notas da
			// cobrança + referência de mês (a cobrança no domínio não tem texto).
			const itensDaCobranca = cb.notas.flatMap((n) => n.itens);
			const cobranca = await atacado.criarCobranca(faturaId, {
				descricao: montarDescricaoCobranca(itensDaCobranca, fatura.dataReferencia),
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
		return erroResultado(TipoErro.ERRO_INTERNO, "Falha ao persistir a árvore da fatura");
	}

	// Passo 8: resposta 201 (criação) / 200 (atualização) com a árvore (IDs reais).
	const corpo = serializarFatura(fatura, faturaId);
	return { corpo, status: modo === "criacao" ? 201 : 200 };
}

/**
 * Serializa a fatura criada/atualizada para a resposta (domínio → JSON, IDs reais).
 * (Espelha o serializador da rota de emissão — mantido aqui coeso ao handler.)
 */
export function serializarFatura(fatura: Fatura, faturaId: number): unknown {
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
