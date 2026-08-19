/**
 * Cálculo da fatura (SPEC-0002 passo 5):
 * - descarta linhas sem plano ou preço zero (caso 9); cliente que fica sem linhas
 *   válidas não entra (caso 2 se todos ficarem).
 * - totaliza por cliente, agrupa serviços, total da fatura em centavos.
 * - consistência: soma das cobranças == fatura até 1 centavo (caso 11 — não deveria
 *   divergir; se divergir, erro interno).
 * - normaliza dataReferencia → YYYY-MM-01 e calcula vencimento no mês seguinte.
 */
import type { Cliente, ErroValidacao, Fatura, Parceiro, Plano, TipoFaturamento } from "#/domain/types";
import { construirPlanoCobrancas } from "./plano-cobrancas";
import { normalizarDataReferencia } from "./normalizacao";
import { calcularDataVencimento } from "./vencimento";
import type { DefaultsFiscais } from "./defaults-fiscais";

/**
 * Filtra clientes que têm ao menos uma linha válida (plano existe e preço > 0).
 * Retorna os clientes com apenas suas linhas válidas.
 */
function clientesComLinhasValidas(
	clientes: Cliente[],
	planos: Plano[],
): Cliente[] {
	const planoById = new Map(planos.map((p) => [p.id, p]));
	return clientes
		.map((c) => ({
			...c,
			linhas: c.linhas.filter((l) => planoById.has(l.planoId) && l.unitario > 0),
		}))
		.filter((c) => c.linhas.length > 0);
}

export interface ResultadoCalculo {
	fatura: Fatura;
	erros: ErroValidacao[];
}

/**
 * Calcula a fatura a partir de parceiro, clientes e planos. Retorna a fatura (com a
 * árvore de cobranças/notas/itens) e uma lista de erros de validação de domínio
 * (vazia = cálculo válido). Não persiste — é domínio puro.
 */
export function calcularFatura(
	parceiro: Parceiro,
	clientes: Cliente[],
	planos: Plano[],
	dataReferencia: string,
	tipoFaturamento: TipoFaturamento,
	defaultsFiscais: DefaultsFiscais,
): ResultadoCalculo {
	const erros: ErroValidacao[] = [];
	const refNormalizada = normalizarDataReferencia(dataReferencia);
	const dataVencimento = calcularDataVencimento(refNormalizada, parceiro.diaVencimento);

	const validos = clientesComLinhasValidas(clientes, planos);
	if (validos.length === 0) {
		erros.push({
			tipo: "FATAL",
			codigo: "SEM_CLIENTES",
			mensagem: "Nenhum cliente com linhas ativas encontrado para faturamento",
		});
		// retorna fatura vazia (sem árvore) — o caller decide 422
		return {
			fatura: {
				parceiroId: parceiro.id,
				dataReferencia: refNormalizada,
				dataVencimento,
				valorTotal: 0,
				tipoFaturamento,
				status: "a-emitir",
				cobrancas: [],
			},
			erros,
		};
	}

	const cobrancas = construirPlanoCobrancas(validos, parceiro, tipoFaturamento, dataVencimento, defaultsFiscais);
	const valorTotal = cobrancas.reduce((acc, c) => acc + c.valorTotal, 0);

	// Caso 11: consistência defensiva (não deveria divergir — cálculo é determinístico).
	const somaNotas = cobrancas.reduce(
		(acc, c) => acc + c.notas.reduce((a, n) => a + n.total, 0),
		0,
	);
	if (Math.abs(somaNotas - valorTotal) > 1) {
		erros.push({
			tipo: "FATAL",
			codigo: "SOMA_DIVERGENTE",
			mensagem: `Inconsistência de cálculo: soma das notas (${somaNotas}) ≠ total da fatura (${valorTotal})`,
		});
	}

	return {
		fatura: {
			parceiroId: parceiro.id,
			dataReferencia: refNormalizada,
			dataVencimento,
			valorTotal,
			tipoFaturamento,
			status: "a-emitir",
			cobrancas,
		},
		erros,
	};
}
