/**
 * Translator Parceiro: `f_*` (t_parceiros) ↔ domínio `Parceiro` (ADR-0004).
 */
import type { Parceiro, Endereco } from "#/domain/types";
import { desmascararDoc } from "./money";

/** Forma externa do parceiro no NocoBase (campos `f_*`). */
export interface ParceiroExterno {
	id: number;
	f_razao_social: string;
	f_fantasia?: string;
	f_cnpj: string;
	f_email_faturamento: string;
	f_data_vencimento?: number;
	f_endereco: string;
	f_numero: string;
	f_bairro: string;
	f_cep: string;
	f_cidade: string;
	f_uf: string;
	f_ie?: string;
}

const DIA_VENCIMENTO_DEFAULT = 10;

export function parceiroToDomain(e: ParceiroExterno): Parceiro {
	const endereco: Endereco = {
		logradouro: e.f_endereco,
		numero: e.f_numero,
		bairro: e.f_bairro,
		cep: e.f_cep,
		cidade: e.f_cidade,
		uf: e.f_uf,
	};
	const dia = e.f_data_vencimento && e.f_data_vencimento > 0
		? e.f_data_vencimento
		: DIA_VENCIMENTO_DEFAULT;
	return {
		id: e.id,
		razaoSocial: e.f_razao_social,
		fantasia: e.f_fantasia,
		cnpj: desmascararDoc(e.f_cnpj),
		emailFaturamento: e.f_email_faturamento,
		diaVencimento: dia,
		endereco,
		ie: e.f_ie,
	};
}
