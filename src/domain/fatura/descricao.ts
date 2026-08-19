/**
 * Montagem da descrição exibida na cobrança (`f_descricao`) a partir do domínio.
 *
 * Era `montarDescricaoCobranca` no translator do Atacado — movida para o domínio
 * (ADR-0004/0007) porque opera só em tipos de domínio (`Item`) e é consumida pela
 * camada HTTP (que não pode importar de `modules/`). O caller persiste via
 * `CriarCobrancaInput.descricao`.
 */
import type { Item } from "#/domain/types";

/** Abreviação pt-BR dos meses (0-indexada) — "Ago/2026". */
const MESES_PT_BR = [
	"Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
	"Jul", "Ago", "Set", "Out", "Nov", "Dez",
] as const;

/** Centavos → string pt-BR (12345 → "99,90" com o prefixo tratado pelo caller),
 * sem separador de milhar. Idem ao formatter do translator Atacado, isolado aqui
 * p/ o domínio não depender de `modules/`. */
function centavosStr(cents: number): string {
	return (cents / 100).toFixed(2).replace(".", ",");
}

/** `dataReferencia` YYYY-MM-01 → "Ago/2026" (operação pura de ano/mês). */
export function mesDeDataReferencia(dataReferencia: string): string {
	const parte = /^(\d{4})-(\d{2})/.exec(dataReferencia);
	if (!parte) {
		throw new Error(`dataReferencia inválida: ${dataReferencia} (esperado YYYY-MM-DD)`);
	}
	const [, ano, mes] = parte;
	return `${MESES_PT_BR[Number(mes) - 1]}/${ano}`;
}

/** Monta a descrição exibida na cobrança: lista de itens (todas as notas) +
 * referência de mês. Formato de cada item: `1x Voz Empresarial = R$ 99,90`.
 * Espelha o app de referência (`itemsDescription\n${resolveMonthReference}`). */
export function montarDescricaoCobranca(
	itens: Item[],
	dataReferencia: string,
): string {
	const linhas = itens.map(
		(item) => `${item.quantidade}x ${item.descricao} = R$ ${centavosStr(item.total)}`,
	);
	return [...linhas, mesDeDataReferencia(dataReferencia)].join("\n");
}
