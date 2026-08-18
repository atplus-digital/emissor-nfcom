/**
 * Translator Cobrança: domínio `Cobranca` ↔ `f_*` (t_nfcom_cobrancas) — ADR-0004.
 *
 * `f_descricao` é obrigatória no CRM e é **derivada** (a cobrança no domínio não
 * tem texto): o caller (camada de persistência) passa a descrição montada a
 * partir das notas/itens + referência de mês — ver `montarDescricaoCobranca`.
 */
import type { Cobranca, Item, StatusCobranca } from "#/domain/types";
import type { CriarCobrancaInput } from "#/domain/ports/atacado.port";
import { centsToReal, centsToRealStr, desmascararDoc, realToCents } from "./money";
import { notaToDomain, type NotaExterna } from "./nota";

/** Abreviação pt-BR dos meses (0-indexada) — "Ago/2026". Espelha o que o app de
 * referência fazia em `resolveMonthReference` (formatter de data). */
const MESES_PT_BR = [
	"Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
	"Jul", "Ago", "Set", "Out", "Nov", "Dez",
] as const;

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
		(item) =>
			`${item.quantidade}x ${item.descricao} = R$ ${centsToRealStr(item.total)}`,
	);
	return [...linhas, mesDeDataReferencia(dataReferencia)].join("\n");
}

export interface CobrancaExterna {
	id: number;
	f_fk_fatura: number;
	f_valor_total: number;
	f_nome_devedor: string;
	f_documento_devedor: string;
	f_email_devedor: string;
	f_status: StatusCobranca | string;
	f_data_vencimento: string;
	f_id_externo: string;
	f_link_fatura: string;
	f_data_emissao: string;
	f_notas_fiscais?: NotaExterna[];
}

export function cobrancaToCreate(input: CriarCobrancaInput): Record<string, unknown> {
	return {
		f_descricao: input.descricao,
		f_valor_total: centsToReal(input.valorTotal),
		f_nome_devedor: input.nomeDevedor,
		f_documento_devedor: input.documentoDevedor,
		f_email_devedor: input.emailDevedor,
		f_status: input.status,
		f_data_vencimento: input.dataVencimento,
	};
}

export function cobrancaToDomain(e: CobrancaExterna, faturaId: number): Cobranca {
	return {
		id: e.id,
		faturaId,
		valorTotal: realToCents(e.f_valor_total),
		nomeDevedor: e.f_nome_devedor,
		documentoDevedor: desmascararDoc(e.f_documento_devedor),
		emailDevedor: e.f_email_devedor,
		status: e.f_status as StatusCobranca,
		idExterno: e.f_id_externo || undefined,
		linkFatura: e.f_link_fatura || undefined,
		dataEmissao: e.f_data_emissao || undefined,
		dataVencimento: e.f_data_vencimento,
		notas: (e.f_notas_fiscais ?? []).map((n) => notaToDomain(n, e.id)),
	};
}
