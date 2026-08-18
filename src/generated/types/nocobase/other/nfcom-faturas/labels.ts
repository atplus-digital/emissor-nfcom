/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: pnpm generate-types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */

import { z } from "zod";

// ============================================================
// LABELS (single source of truth)
// ============================================================
export const NFCOM_FATURAS_FIELD_LABELS = {
	createdAt: "Criado em",
	createdBy: "Criado por",
	createdById: "createdById",
	f_cobrancas: "Cobranças",
	f_data_referencia: "Mês de Referência",
	f_data_vencimento: "Data de Vencimento",
	f_fk_parceiro: "f_fk_parceiro",
	f_parceiro: "Parceiro",
	f_status: "Status",
	f_tipo_de_faturamento: "Tipo de Faturamento",
	f_valor_total: "Valor Total",
	id: "ID",
	updatedAt: "Última atualização em",
	updatedBy: "Última atualização por",
	updatedById: "updatedById",
} as const;

export const FIELD_LABELS = NFCOM_FATURAS_FIELD_LABELS;

export const NFCOM_FATURAS_STATUS_LABELS = {
	"a-emitir": "A Emitir",
	emitindo: "Emitindo",
	emitida: "Fatura e NF Emitida",
	parcial: "Parcialmente Emitida",
	erro: "Erro ao emitir",
	pago: "Pago",
	cancelada: "Cancelada",
} as const;

export const NFCOM_FATURAS_TIPO_DE_FATURAMENTO_LABELS = {
	parceiro: "Parceiro",
	"via-parceiro": "Via Parceiro",
	cofaturamento: "Cofaturamento",
	"cliente-final": "Cliente Final",
} as const;

export const ENUM_LABELS_BY_FIELD = {
	f_status: NFCOM_FATURAS_STATUS_LABELS,
	f_tipo_de_faturamento: NFCOM_FATURAS_TIPO_DE_FATURAMENTO_LABELS,
} as const;

// ============================================================
// ENUM SCHEMAS (validação em runtime)
// ============================================================
export const nfcom_faturasStatusSchema = z.enum(
	["a-emitir", "emitindo", "emitida", "parcial", "erro", "pago", "cancelada"],
	{
		error: () => ({
			message:
				"status: valores válidos são [A Emitir, Emitindo, Fatura e NF Emitida, Parcialmente Emitida, Erro ao emitir, Pago, Cancelada]",
		}),
	},
);

export const nfcom_faturasTipoDeFaturamentoSchema = z.enum(
	["parceiro", "via-parceiro", "cofaturamento", "cliente-final"],
	{
		error: () => ({
			message:
				"tipo_de_faturamento: valores válidos são [Parceiro, Via Parceiro, Cofaturamento, Cliente Final]",
		}),
	},
);

// ============================================================
// ENUM TYPES (inferidos dos schemas)
// ============================================================
export type NfcomFaturasStatus = z.infer<typeof nfcom_faturasStatusSchema>;

export type NfcomFaturasTipoDeFaturamento = z.infer<
	typeof nfcom_faturasTipoDeFaturamentoSchema
>;
