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
 * Calcula o vencimento: dia `diaVencimentoParceiro` (default 10) do mês seguinte ao
 * da `dataReferencia` (em YYYY-MM-DD, qualquer dia). Retorna YYYY-MM-DD.
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
	const dia =
		diaVencimentoParceiro && diaVencimentoParceiro > 0
			? diaVencimentoParceiro
			: DIA_VENCIMENTO_DEFAULT;
	const mesStr = String(mes).padStart(2, "0");
	const diaStr = String(dia).padStart(2, "0");
	return `${ano}-${mesStr}-${diaStr}`;
}
