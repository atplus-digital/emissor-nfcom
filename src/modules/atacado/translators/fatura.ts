/**
 * Translator Fatura: domínio `Fatura` ↔ `f_*` (t_nfcom_faturas) — ADR-0004.
 * Monetário: centavos ↔ unidade real. Status/tipo seguem enums do CRM.
 */
import type { Fatura, StatusFatura, TipoFaturamento } from "#/domain/types";
import type { CriarFaturaInput } from "#/domain/ports/atacado.port";
import { centsToReal, realToCents } from "./money";
import { cobrancaToDomain, type CobrancaExterna } from "./cobranca";

export interface FaturaExterna {
	id: number;
	f_fk_parceiro: number;
	f_data_referencia: string;
	f_data_vencimento: string;
	f_valor_total: number;
	f_tipo_de_faturamento: TipoFaturamento;
	f_status: StatusFatura;
	f_cobrancas?: CobrancaExterna[];
}

export function faturaToCreate(input: CriarFaturaInput): Record<string, unknown> {
	return {
		f_fk_parceiro: input.parceiroId,
		f_data_referencia: input.dataReferencia,
		f_data_vencimento: input.dataVencimento,
		f_valor_total: centsToReal(input.valorTotal),
		f_tipo_de_faturamento: input.tipoFaturamento,
		f_status: input.status,
	};
}

export function faturaToDomain(e: FaturaExterna): Fatura {
	return {
		id: e.id,
		parceiroId: e.f_fk_parceiro,
		dataReferencia: e.f_data_referencia,
		dataVencimento: e.f_data_vencimento,
		valorTotal: realToCents(e.f_valor_total),
		tipoFaturamento: e.f_tipo_de_faturamento,
		status: e.f_status,
		cobrancas: (e.f_cobrancas ?? []).map((c) => cobrancaToDomain(c, e.id)),
	};
}
