/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: bun run generate:types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */

import { z } from "zod";

// ============================================================
// LABELS (single source of truth)
// ============================================================
export const LINHAS_FIXAS_FIELD_LABELS = {
	createdAt: "Criado em",
	createdBy: "Criado por",
	createdById: "createdById",
	f_assinatura: "Assinatura",
	f_canais: "Canais",
	f_cdr: "CDR",
	f_coghzwfvcnx: "f_coghzwfvcnx",
	f_data_ativacao: "Data de Ativação",
	f_dids: "DID's",
	f_fk_cliente: "Cliente",
	f_fk_linhas_fixas: "f_fk_linhas_fixas",
	f_motivo_recusa: "Motivo Recusa",
	f_n_contrato: "N. Contrato",
	f_obs_portabilidade: "Observações Portabilidade",
	f_planos_de_servico: "Planos de Serviço",
	f_portabilidade: "Portabilidade",
	f_qtde_servicos: "Quantidade de Serviços",
	f_status: "Status",
	f_terminal: "Terminal",
	f_terminal_final: "Terminal Final",
	id: "ID",
	updatedAt: "Última atualização em",
	updatedBy: "Última atualização por",
	updatedById: "updatedById",
} as const;

export const FIELD_LABELS = LINHAS_FIXAS_FIELD_LABELS;

export const LINHAS_FIXAS_PORTABILIDADE_LABELS = {
	0: "Não",
	1: "Sim",
} as const;

export const LINHAS_FIXAS_STATUS_LABELS = {
	1: "Ativo",
	2: "Cancelado",
	0: "Aguardando Ativação",
	3: "Bloqueado",
	4: "Divergência Portabilidade",
	5: "Cancelado pelo Parceiro",
	6: "Portabilidade Autorizada",
	7: "Portabilidade Solicitada",
	8: "StandBy",
	9: "Em Andamento",
} as const;

export const ENUM_LABELS_BY_FIELD = {
	f_portabilidade: LINHAS_FIXAS_PORTABILIDADE_LABELS,
	f_status: LINHAS_FIXAS_STATUS_LABELS,
} as const;

// ============================================================
// ENUM SCHEMAS (validação em runtime)
// ============================================================
export const linhas_fixasPortabilidadeSchema = z.enum(["0", "1"], {
	error: () => ({ message: "portabilidade: valores válidos são [Não, Sim]" }),
});

export const linhas_fixasStatusSchema = z.enum(
	["1", "2", "0", "3", "4", "5", "6", "7", "8", "9"],
	{
		error: () => ({
			message:
				"status: valores válidos são [Ativo, Cancelado, Aguardando Ativação, Bloqueado, Divergência Portabilidade, Cancelado pelo Parceiro, Portabilidade Autorizada, Portabilidade Solicitada, StandBy, Em Andamento]",
		}),
	},
);

// ============================================================
// ENUM TYPES (inferidos dos schemas)
// ============================================================
export type LinhasFixasPortabilidade = z.infer<
	typeof linhas_fixasPortabilidadeSchema
>;

export type LinhasFixasStatus = z.infer<typeof linhas_fixasStatusSchema>;
