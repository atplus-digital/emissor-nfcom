/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: bun run generate:types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */

import { z } from "zod";
import { nfcom_errosBaseSchema } from "../nfcom-erros/schemas";
import { nfcom_faturasBaseSchema } from "../nfcom-faturas/schemas";
import { nfcom_notasBaseSchema } from "../nfcom-notas/schemas";
import { nfcom_itens_adicionaisBaseSchema } from "../other/nfcom-itens-adicionais/schemas";
import { usersBaseSchema } from "../users/schemas";
import { nfcom_cobrancasStatusSchema } from "./labels";

export const TABLE_NAME = "t_nfcom_cobrancas";
export const TABLE_LABEL = "Cobranças (Nfcom)";

// ============================================================
// BASE SCHEMA (campos escalares)
// ============================================================
export const nfcom_cobrancasBaseSchema = z.object({
	id: z.number(),
	f_fk_fatura: z.number(),
	f_data_emissao: z.string(),
	f_data_vencimento: z.string(),
	f_descricao: z.string(),
	f_documento_devedor: z.string(),
	f_email_devedor: z.string(),
	f_id_externo: z.string(),
	f_link_fatura: z.string(),
	f_nome_devedor: z.string(),
	f_status: nfcom_cobrancasStatusSchema,
	f_valor_total: z.number(),
	updatedAt: z.string(),
	updatedById: z.string(),
	createdAt: z.string(),
	createdById: z.string(),
});

// ============================================================
// RELATION SCHEMA (campos de relação)
// ============================================================
export const nfcom_cobrancasRelationSchema = z.object({
	createdBy: z.lazy(() => usersBaseSchema.nullable()),
	f_erro: z.lazy(() => nfcom_errosBaseSchema.nullable()),
	f_fatura: z.lazy(() => nfcom_faturasBaseSchema.nullable()),
	f_itens_adicionais: z.lazy(() => nfcom_itens_adicionaisBaseSchema.array()),
	f_notas_fiscais: z.lazy(() => nfcom_notasBaseSchema.array()),
	updatedBy: z.lazy(() => usersBaseSchema.nullable()),
});

export const RELATION_TARGETS = {
	createdBy: "users",
	f_erro: "t_nfcom_erros",
	f_fatura: "t_nfcom_faturas",
	f_itens_adicionais: "t_nfcom_itens_adicionais",
	f_notas_fiscais: "t_nfcom_notas",
	updatedBy: "users",
} as const;

// ============================================================
// SCHEMA PRINCIPAL (validação completa)
// ============================================================
export const nfcom_cobrancasSchema = nfcom_cobrancasBaseSchema.extend(
	nfcom_cobrancasRelationSchema.shape,
);

// ============================================================
// CREATE SCHEMA
// ============================================================
export const nfcom_cobrancasCreateSchema = nfcom_cobrancasSchema.omit({
	createdAt: true,
	createdBy: true,
	createdById: true,
	f_erro: true,
	f_fatura: true,
	f_itens_adicionais: true,
	f_notas_fiscais: true,
	id: true,
	updatedAt: true,
	updatedBy: true,
	updatedById: true,
});

// ============================================================
// UPDATE SCHEMA
// ============================================================
export const nfcom_cobrancasUpdateSchema =
	nfcom_cobrancasCreateSchema.partial();
