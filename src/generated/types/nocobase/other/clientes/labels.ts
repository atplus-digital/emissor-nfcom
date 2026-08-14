/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: pnpm generate-types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */

import { z } from "zod";

// ============================================================
// LABELS (single source of truth)
// ============================================================
export const CLIENTES_FIELD_LABELS = {
	createdAt: "Criado em",
	createdBy: "Criado por",
	createdById: "createdById",
	f_area_local: "Área Local",
	f_bairro: "Bairro",
	f_cep: "CEP",
	f_cidade: "Cidade",
	f_codigo_area_local: "Código Área Local",
	f_codigo_cnl: "Código CNL",
	f_cpf_cnpj: "CPF / CNPJ",
	f_dids: "DID's",
	f_email: "E-mail",
	f_endereco: "Endereço",
	f_fantasia: "Nome Fantasia",
	f_fk_parceiro: "f_fk_parceiro",
	f_fk_servicos_adicionais: "f_fk_servicos_adicionais",
	f_linhas_fixas: "Linhas Fixas",
	f_nome_razao: "Nome / Razão Social",
	f_numero: "Numero",
	f_parceiro: "Parceiro",
	f_rg_ie: "RG / IE",
	f_servicos_adicionais: "Serviços Adicionais",
	f_telefone: "Telefone",
	f_tipo_assinante: "Tipo de Assinante",
	f_uf: "UF",
	id: "ID",
	updatedAt: "Última atualização em",
	updatedBy: "Última atualização por",
	updatedById: "updatedById",
} as const;

export const FIELD_LABELS = CLIENTES_FIELD_LABELS;

export const CLIENTES_TIPO_ASSINANTE_LABELS = {
	1: "Comercial",
	2: "Industrial",
	3: "Residencial/Pessoa Física",
	4: "Produtor Rural",
	5: "Órgão da administração pública estadual direta e suas fundações e autarquias, quando mantidas pelo poder público estadual e regidas por normas de direito público, nos termos do Convênio ICMS 107/95",
	6: "Prestador de serviço de telecomunicação responsável pelo recolhimento do imposto incidente sobre a cessão dos meios de rede do prestador do serviço ao usuário final, nos termos do Convênio ICMS 17/13",
	7: "Missões Diplomáticas, Repartições Consulares e Organismos Internacionais, nos termos do Convênio ICMS 158/94",
	8: "Igrejas e Templos de qualquer natureza",
	99: "Outros não especificados anteriormente",
} as const;

export const ENUM_LABELS_BY_FIELD = {
	f_tipo_assinante: CLIENTES_TIPO_ASSINANTE_LABELS,
} as const;

// ============================================================
// ENUM SCHEMAS (validação em runtime)
// ============================================================
export const clientesTipoAssinanteSchema = z.enum(
	["1", "2", "3", "4", "5", "6", "7", "8", "99"],
	{
		error: () => ({
			message:
				"tipo_assinante: valores válidos são [Comercial, Industrial, Residencial/Pessoa Física, Produtor Rural, Órgão da administração pública estadual direta e suas fundações e autarquias, quando mantidas pelo poder público estadual e regidas por normas de direito público, nos termos do Convênio ICMS 107/95, Prestador de serviço de telecomunicação responsável pelo recolhimento do imposto incidente sobre a cessão dos meios de rede do prestador do serviço ao usuário final, nos termos do Convênio ICMS 17/13, Missões Diplomáticas, Repartições Consulares e Organismos Internacionais, nos termos do Convênio ICMS 158/94, Igrejas e Templos de qualquer natureza, Outros não especificados anteriormente]",
		}),
	},
);

// ============================================================
// ENUM TYPES (inferidos dos schemas)
// ============================================================
export type ClientesTipoAssinante = z.infer<typeof clientesTipoAssinanteSchema>;
