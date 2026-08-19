/**
 * Translator Cobrança: domínio `Cobranca` ↔ `f_*` (t_nfcom_cobrancas) — ADR-0004.
 *
 * `f_descricao` é obrigatória no CRM e é **derivada** (a cobrança no domínio não
 * tem texto): o caller passa a descrição montada a partir das notas/itens +
 * referência de mês — ver `#/domain/fatura/descricao` (`montarDescricaoCobranca`).
 */
import type { Cobranca, StatusCobranca } from "#/domain/types";
import type { CriarCobrancaInput } from "#/domain/ports/atacado.port";
import { centsToReal, desmascararDoc, realToCents } from "./money";
import { notaToDomain, type NotaExterna } from "./nota";

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
