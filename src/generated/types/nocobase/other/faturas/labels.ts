/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: pnpm generate-types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */

import { z } from "zod";

// ============================================================
// LABELS (single source of truth)
// ============================================================
export const FATURAS_FIELD_LABELS = {
	createdAt: "Criado em",
	createdBy: "Criado por",
	createdById: "createdById",
	f_data_emissao: "Data de Emissão",
	f_data_vencimento: "Data de Vencimento",
	f_descricao: "Descrição",
	f_fk_parceiros: "f_fk_parceiros",
	f_id_externo: "ID Externo",
	f_link_fatura: "Link da Fatura",
	f_parceiros: "Parceiros",
	f_status: "Status",
	f_substatus: "Substatus",
	f_tipo_de_cobranca: "Tipo de Cobrança",
	f_valor_total: "Valor Total",
	id: "ID",
	updatedAt: "Última atualização em",
	updatedBy: "Última atualização por",
	updatedById: "updatedById",
} as const;

export const FIELD_LABELS = FATURAS_FIELD_LABELS;

export const FATURAS_STATUS_LABELS = {
	0: "A Receber",
	1: "Pago",
	3: "Vencido",
} as const;

export const FATURAS_SUBSTATUS_LABELS = {
	0: "Gerando Fatura",
	1: "Fatura Gerada",
	2: "Erro de Integração",
} as const;

export const FATURAS_TIPO_DE_COBRANCA_LABELS = {
	parceiro: "Parceiro (padrão)",
	"via-parceiro": "Via Parceiro (nota para cliente)",
	cofaturamento: "Cofaturamento",
	"cliente-final": "Cliente Final (fatura e nota para cliente)",
} as const;

export const ENUM_LABELS_BY_FIELD = {
	f_status: FATURAS_STATUS_LABELS,
	f_substatus: FATURAS_SUBSTATUS_LABELS,
	f_tipo_de_cobranca: FATURAS_TIPO_DE_COBRANCA_LABELS,
} as const;

// ============================================================
// ENUM SCHEMAS (validação em runtime)
// ============================================================
export const faturasStatusSchema = z.enum(["0", "1", "3"], {
	error: () => ({
		message: "status: valores válidos são [A Receber, Pago, Vencido]",
	}),
});

export const faturasSubstatusSchema = z.enum(["0", "1", "2"], {
	error: () => ({
		message:
			"substatus: valores válidos são [Gerando Fatura, Fatura Gerada, Erro de Integração]",
	}),
});

export const faturasTipoDeCobrancaSchema = z.enum(
	["parceiro", "via-parceiro", "cofaturamento", "cliente-final"],
	{
		error: () => ({
			message:
				"tipo_de_cobranca: valores válidos são [Parceiro (padrão), Via Parceiro (nota para cliente), Cofaturamento, Cliente Final (fatura e nota para cliente)]",
		}),
	},
);

// ============================================================
// ENUM TYPES (inferidos dos schemas)
// ============================================================
export type FaturasStatus = z.infer<typeof faturasStatusSchema>;

export type FaturasSubstatus = z.infer<typeof faturasSubstatusSchema>;

export type FaturasTipoDeCobranca = z.infer<typeof faturasTipoDeCobrancaSchema>;
