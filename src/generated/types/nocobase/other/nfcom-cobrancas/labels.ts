/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: pnpm generate-types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */

import { z } from "zod";

// ============================================================
// LABELS (single source of truth)
// ============================================================
export const NFCOM_COBRANCAS_FIELD_LABELS = {
	createdAt: "Criado em",
	createdBy: "Criado por",
	createdById: "createdById",
	f_data_emissao: "Data de Emissão",
	f_data_vencimento: "Data de Vencimento",
	f_descricao: "Descrição",
	f_documento_devedor: "Documento do Devedor",
	f_email_devedor: "Email Devedor",
	f_erro: "Erro de Emissão",
	f_fatura: "Fatura",
	f_fk_fatura: "f_fk_fatura",
	f_id_externo: "ID Externo",
	f_itens_adicionais: "Itens Adicionais",
	f_link_fatura: "Link Fatura",
	f_nome_devedor: "Nome Devedor",
	f_notas_fiscais: "Notas Fiscais (NFcom)",
	f_status: "Status",
	f_valor_total: "Valor Total",
	id: "ID",
	updatedAt: "Última atualização em",
	updatedBy: "Última atualização por",
	updatedById: "updatedById",
} as const;

export const FIELD_LABELS = NFCOM_COBRANCAS_FIELD_LABELS;

export const NFCOM_COBRANCAS_STATUS_LABELS = {
	"a-emitir": "A emitir",
	emitida: "Cobrança Emitida",
	erro: "Erro ao Gerar Cobrança",
	paga: "Paga",
	vencida: "Vencido",
	cancelada: "Cancelada",
} as const;

export const ENUM_LABELS_BY_FIELD = {
	f_status: NFCOM_COBRANCAS_STATUS_LABELS,
} as const;

// ============================================================
// ENUM SCHEMAS (validação em runtime)
// ============================================================
export const nfcom_cobrancasStatusSchema = z.enum(
	["a-emitir", "emitida", "erro", "paga", "vencida", "cancelada"],
	{
		error: () => ({
			message:
				"status: valores válidos são [A emitir, Cobrança Emitida, Erro ao Gerar Cobrança, Paga, Vencido, Cancelada]",
		}),
	},
);

// ============================================================
// ENUM TYPES (inferidos dos schemas)
// ============================================================
export type NfcomCobrancasStatus = z.infer<typeof nfcom_cobrancasStatusSchema>;
