/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: pnpm generate-types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */

import { z } from "zod";

// ============================================================
// LABELS (single source of truth)
// ============================================================
export const DIDS_FIELD_LABELS = {
	createdAt: "Criado em",
	createdBy: "Criado por",
	createdById: "createdById",
	f_area_local: "Área Local",
	f_codigo_area_local: "Código de Área Local",
	f_disponivel_venda: "Disponível para venda?",
	f_e_ddr: "É DDR?",
	f_encaminhamento: "Encaminhamento de Chamadas",
	f_fk_dids: "f_fk_dids",
	f_fk_ip_encaminhamento: "f_fk_ip_encaminhamento",
	f_fk_parceiros: "f_fk_parceiros",
	f_ip_encaminhamento: "IP de Encaminhamento",
	f_p7t1gu76z7p: "Serviço",
	f_parceiros: "Parceiros",
	f_profile: "Profile",
	f_secao_did: "Seção do DID",
	f_sigla_area_local: "Sigla da Área Local",
	f_status: "Status",
	f_terminal: "Terminal",
	f_terminal_final: "Terminal Final",
	id: "ID",
	t_anexos_portabilidades_dids: "Anexos Portabilidades DIDS",
	updatedAt: "Última atualização em",
	updatedBy: "Última atualização por",
	updatedById: "updatedById",
} as const;

export const FIELD_LABELS = DIDS_FIELD_LABELS;

export const DIDS_DISPONIVEL_VENDA_LABELS = {
	0: "Não",
	1: "Sim",
} as const;

export const DIDS_ENCAMINHAMENTO_LABELS = {
	1: "IP",
	2: "Usuário e Senha",
} as const;

export const DIDS_PROFILE_LABELS = {
	CLI: "CLI",
	DEFAULT: "DEFAULT",
	DIDS_OUTROS: "DIDS_OUTROS",
	REDESUL: "REDESUL",
	STFC_CN47_GERAL: "STFC_CN47_GERAL",
	STFC_CN47_JVE: "STFC_CN47_JVE",
	STFC_CN48_FNS: "STFC_CN48_FNS",
	STFC_CN48_GERAL: "STFC_CN48_GERAL",
	STFC_CN49_GERAL: "STFC_CN49_GERAL",
	STFC_CN49_LGS: "STFC_CN49_LGS",
	TESTE: "TESTE",
} as const;

export const DIDS_SECAO_DID_LABELS = {
	atplus: "ATPlus",
	atacado: "Atacado",
} as const;

export const DIDS_STATUS_LABELS = {
	0: "Cancelado",
	1: "Aguardando Portabilidade",
	2: "Divergencia Portabilidade",
	3: "Ativo",
	4: "Disponível",
} as const;

export const ENUM_LABELS_BY_FIELD = {
	f_disponivel_venda: DIDS_DISPONIVEL_VENDA_LABELS,
	f_encaminhamento: DIDS_ENCAMINHAMENTO_LABELS,
	f_profile: DIDS_PROFILE_LABELS,
	f_secao_did: DIDS_SECAO_DID_LABELS,
	f_status: DIDS_STATUS_LABELS,
} as const;

// ============================================================
// ENUM SCHEMAS (validação em runtime)
// ============================================================
export const didsDisponivelVendaSchema = z.enum(["0", "1"], {
	error: () => ({
		message: "disponivel_venda: valores válidos são [Não, Sim]",
	}),
});

export const didsEncaminhamentoSchema = z.enum(["1", "2"], {
	error: () => ({
		message: "encaminhamento: valores válidos são [IP, Usuário e Senha]",
	}),
});

export const didsProfileSchema = z.enum(
	[
		"CLI",
		"DEFAULT",
		"DIDS_OUTROS",
		"REDESUL",
		"STFC_CN47_GERAL",
		"STFC_CN47_JVE",
		"STFC_CN48_FNS",
		"STFC_CN48_GERAL",
		"STFC_CN49_GERAL",
		"STFC_CN49_LGS",
		"TESTE",
	],
	{
		error: () => ({
			message:
				"profile: valores válidos são [CLI, DEFAULT, DIDS_OUTROS, REDESUL, STFC_CN47_GERAL, STFC_CN47_JVE, STFC_CN48_FNS, STFC_CN48_GERAL, STFC_CN49_GERAL, STFC_CN49_LGS, TESTE]",
		}),
	},
);

export const didsSecaoDidSchema = z.enum(["atplus", "atacado"], {
	error: () => ({
		message: "secao_did: valores válidos são [ATPlus, Atacado]",
	}),
});

export const didsStatusSchema = z.enum(["0", "1", "2", "3", "4"], {
	error: () => ({
		message:
			"status: valores válidos são [Cancelado, Aguardando Portabilidade, Divergencia Portabilidade, Ativo, Disponível]",
	}),
});

// ============================================================
// ENUM TYPES (inferidos dos schemas)
// ============================================================
export type DidsDisponivelVenda = z.infer<typeof didsDisponivelVendaSchema>;

export type DidsEncaminhamento = z.infer<typeof didsEncaminhamentoSchema>;

export type DidsProfile = z.infer<typeof didsProfileSchema>;

export type DidsSecaoDid = z.infer<typeof didsSecaoDidSchema>;

export type DidsStatus = z.infer<typeof didsStatusSchema>;
