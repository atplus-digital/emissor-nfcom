/**
 * Cálculo de `dataVencimento` (SPEC-0002 caso 10): dia de vencimento do parceiro
 * (default 10) sobre o **mês seguinte** ao da `dataReferencia`. Fatura de agosto
 * vence em setembro. Rollover de ano (dezembro → janeiro do ano seguinte).
 *
 * Operação pura sobre partes (ano/mês) — não depende do fuso do container (UTC em
 * produção). CONVENTIONS.md declara America/Sao_Paulo para datas de domínio; como a
 * data de vencimento é uma data pura (sem hora do dia), o resultado é o mesmo em
 * qualquer fuso: computamos o próximo mês como inteiros.
 */

export const DIA_VENCIMENTO_DEFAULT = 10;

/**
 * Último dia válido do mês/ano (Gregoriano): fevereiro tem 28, ou 29 em ano
 * bissexto (divisível por 4, exceto múltiplos de 100 que não sejam de 400).
 */
function ultimoDiaDoMes(ano: number, mes: number): number {
	// meses com 31 dias
	if (mes === 1 || mes === 3 || mes === 5 || mes === 7 || mes === 8 || mes === 10 || mes === 12) {
		return 31;
	}
	// meses com 30 dias
	if (mes === 4 || mes === 6 || mes === 9 || mes === 11) {
		return 30;
	}
	// fevereiro
	const bissexto = (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
	return bissexto ? 29 : 28;
}

/**
 * Calcula o vencimento: dia `diaVencimentoParceiro` (default 10) do mês seguinte ao
 * da `dataReferencia` (em YYYY-MM-DD, qualquer dia). Retorna YYYY-MM-DD.
 *
 * O dia é **clampado** ao último dia válido do mês-alvo: um parceiro com dia 31
 * numa fatura de janeiro (vence em fevereiro) → 28/29, não "2026-02-31"
 * (data inexistente). Idem dia 31 em abril/junho/setembro/novembro → 30.
 * Pendente de revisão com o negócio (CONVENTIONS Revisão humana) — clamp-to-last-day
 * é o default são; o behavior alternativo (empurrar ao mês seguinte) é SPEC futura.
 */
export function calcularDataVencimento(
	dataReferencia: string,
	diaVencimentoParceiro?: number,
): string {
	const partes = /^(\d{4})-(\d{2})-\d{2}$/.exec(dataReferencia);
	if (!partes) {
		throw new Error(`dataReferencia inválida: ${dataReferencia} (esperado YYYY-MM-DD)`);
	}
	let ano = Number(partes[1]);
	let mes = Number(partes[2]) + 1;
	if (mes > 12) {
		mes = 1;
		ano += 1;
	}
	const diaDesejado =
		diaVencimentoParceiro && diaVencimentoParceiro > 0
			? diaVencimentoParceiro
			: DIA_VENCIMENTO_DEFAULT;
	const dia = Math.min(diaDesejado, ultimoDiaDoMes(ano, mes));
	const mesStr = String(mes).padStart(2, "0");
	const diaStr = String(dia).padStart(2, "0");
	return `${ano}-${mesStr}-${diaStr}`;
}
