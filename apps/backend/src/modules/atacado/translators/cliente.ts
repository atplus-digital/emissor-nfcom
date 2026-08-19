/**
 * Translator Cliente: `f_*` (t_clientes + t_linhas_fixas + t_planos_de_servico)
 * ↔ domínio `Cliente` (ADR-0004). Linhas vêm da relação f_linhas_fixas, com
 * o plano em f_planos_de_servico.
 */
import type { Cliente, Linha } from "#/domain/types";
import { desmascararDoc, realToCents } from "./money";

export interface LinhaFixaExterna {
	id: number;
	f_qtde_servicos?: number;
	f_planos_de_servico?: {
		id: number;
		f_nome: string;
		f_assinatura_mensal: number;
	} | null;
}

export interface ClienteExterno {
	id: number;
	f_nome_razao: string;
	f_fantasia?: string;
	f_cpf_cnpj: string;
	f_email: string;
	f_endereco: string;
	f_numero: string;
	f_bairro: string;
	f_cep: string;
	f_cidade: string;
	f_uf: string;
	f_linhas_fixas?: LinhaFixaExterna[];
}

export function clienteToDomain(e: ClienteExterno): Cliente {
	const linhas: Linha[] = (e.f_linhas_fixas ?? [])
		.filter((l) => l.f_planos_de_servico != null)
		.map((l) => {
			const plano = l.f_planos_de_servico!;
			return {
				planoId: plano.id,
				descricao: plano.f_nome,
				unitario: realToCents(plano.f_assinatura_mensal),
				quantidade: l.f_qtde_servicos ?? 1,
			};
		});
	return {
		id: e.id,
		nome: e.f_nome_razao,
		fantasia: e.f_fantasia,
		cpfcnpj: desmascararDoc(e.f_cpf_cnpj),
		email: e.f_email,
		endereco: {
			logradouro: e.f_endereco,
			numero: e.f_numero,
			bairro: e.f_bairro,
			cep: e.f_cep,
			cidade: e.f_cidade,
			uf: e.f_uf,
		},
		linhas,
	};
}
