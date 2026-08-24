/**
 * Normalização de IE (Inscrição Estadual) na fronteira fiscal (Defeito B).
 *
 * O CRM (NocoBase) carrega `f_ie` livre por parceiro — parceiros sem inscrição
 * estadual cadastram o literal "ISENTO" (ou deixam o campo vazio). O domínio
 * continua carregando o valor cru (`Parceiro.ie`/`Nota.rgie`); a normalização
 * acontece só onde o valor cruza a fronteira — tradutor do gateway NFCom e
 * validação de preparação (mesma filosofia do `mascararDoc` em
 * `src/domain/fatura/cpf-cnpj.ts`: limpo no domínio, normalizado só no gateway).
 */

/**
 * Retorna a IE só se for um valor numérico plausível.
 *
 * `"ISENTO"` (case-insensitive), vazio, whitespace e `undefined` → `undefined`
 * (destinatário sem IE → campo omitido no payload do gateway). `"0"` é
 * tratado como IE válida (aceitamos o numérico; a validação de dígito
 * verificador da IE é do SEFAZ, não da fronteira).
 */
export function normalizarIE(ie: string | null | undefined): string | undefined {
	if (ie === undefined || ie === null) return undefined;
	const limpa = ie.trim();
	if (limpa === "") return undefined;
	if (limpa.toUpperCase() === "ISENTO") return undefined;
	if (!/^\d+$/.test(limpa)) return undefined;
	return limpa;
}
