/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: bun run generate:types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */

import { z } from "zod";

// ============================================================
// LABELS (single source of truth)
// ============================================================
export const SERVICOS_ADICIONAIS_FIELD_LABELS = {
	createdAt: "Criado em",
	createdBy: "Criado por",
	createdById: "createdById",
	f_armazenamento: "Quantidade de Armazenamento",
	f_armazenamento_mb: "Armazenamento em MB",
	f_clientes_contratos: "Clientes (Contratos)",
	f_descricao: "Descrição",
	f_faixa_fin: "Faixa Final",
	f_faixa_ini: "Faixa Inicial",
	f_fk_servicos_adicionais: "f_fk_servicos_adicionais",
	f_informacoes_acesso: "Informações de Acesso",
	f_ramais: "Quantidade de Ramais",
	f_tipo_servico: "Tipo de Serviço",
	f_valor_mensal: "Valor Mensal",
	f_valor_pabx: "Valor PABX",
	id: "ID",
	updatedAt: "Última atualização em",
	updatedBy: "Última atualização por",
	updatedById: "updatedById",
} as const;

export const FIELD_LABELS = SERVICOS_ADICIONAIS_FIELD_LABELS;

export const SERVICOS_ADICIONAIS_TIPO_SERVICO_LABELS = {
	0: "Plano de Ligações Internacionais",
	1: "Número SUP",
	3: "PABX em Nuvem",
} as const;

export const ENUM_LABELS_BY_FIELD = {
	f_tipo_servico: SERVICOS_ADICIONAIS_TIPO_SERVICO_LABELS,
} as const;

// ============================================================
// ENUM SCHEMAS (validação em runtime)
// ============================================================
export const servicos_adicionaisTipoServicoSchema = z.enum(["0", "1", "3"], {
	error: () => ({
		message:
			"tipo_servico: valores válidos são [Plano de Ligações Internacionais, Número SUP, PABX em Nuvem]",
	}),
});

// ============================================================
// ENUM TYPES (inferidos dos schemas)
// ============================================================
export type ServicosAdicionaisTipoServico = z.infer<
	typeof servicos_adicionaisTipoServicoSchema
>;
