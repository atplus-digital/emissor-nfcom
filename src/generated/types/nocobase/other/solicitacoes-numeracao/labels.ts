/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: pnpm generate-types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */

import { z } from "zod";

// ============================================================
// LABELS (single source of truth)
// ============================================================
export const SOLICITACOES_NUMERACAO_FIELD_LABELS = {
	createdAt: "Criado em",
	createdBy: "Criado por",
	createdById: "createdById",
	f_canais: "Canais",
	f_contrato: "Contrato",
	f_fk_contrato: "f_fk_contrato",
	f_fk_servico: "f_fk_servico",
	f_portabilidade: "Portabilidade",
	f_servico: "Serviço",
	f_solicitacoes_de_numeracao: "f_solicitacoes_de_numeracao",
	f_terminal: "Terminal",
	f_terminal_final: "Terminal Final",
	f_terminal_inicial: "Terminal Inicial",
	id: "ID",
	updatedAt: "Última atualização em",
	updatedBy: "Última atualização por",
	updatedById: "updatedById",
} as const;

export const FIELD_LABELS = SOLICITACOES_NUMERACAO_FIELD_LABELS;

export const SOLICITACOES_NUMERACAO_PORTABILIDADE_LABELS = {
	0: "Não",
	1: "Sim",
} as const;

export const ENUM_LABELS_BY_FIELD = {
	f_portabilidade: SOLICITACOES_NUMERACAO_PORTABILIDADE_LABELS,
} as const;

// ============================================================
// ENUM SCHEMAS (validação em runtime)
// ============================================================
export const solicitacoes_numeracaoPortabilidadeSchema = z.enum(["0", "1"], {
	error: () => ({ message: "portabilidade: valores válidos são [Não, Sim]" }),
});

// ============================================================
// ENUM TYPES (inferidos dos schemas)
// ============================================================
export type SolicitacoesNumeracaoPortabilidade = z.infer<
	typeof solicitacoes_numeracaoPortabilidadeSchema
>;
