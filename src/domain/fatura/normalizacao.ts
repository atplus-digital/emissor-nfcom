/**
 * Normaliza `dataReferencia` para o 1º dia do mês (YYYY-MM-01) — chave natural da
 * fatura (SPEC-0002): 2026-08-15 e 2026-08-01 são a mesma fatura.
 */

/**
 * Normaliza uma data no formato YYYY-MM-DD para YYYY-MM-01 (1º dia do mês).
 * Não depende de fuso (operação pura de ano/mês).
 */
export function normalizarDataReferencia(data: string): string {
	const partes = /^(\d{4})-(\d{2})-\d{2}$/.exec(data);
	if (!partes) {
		throw new Error(`dataReferencia inválida: ${data} (esperado YYYY-MM-DD)`);
	}
	const [, ano, mes] = partes;
	return `${ano}-${mes}-01`;
}
