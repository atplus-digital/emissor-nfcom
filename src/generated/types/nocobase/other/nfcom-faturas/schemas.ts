/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: pnpm generate-types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */

import { z } from "zod";
import { usersBaseSchema } from "../../users/schemas";
import { nfcom_cobrancasBaseSchema } from "../nfcom-cobrancas/schemas";
import { parceirosBaseSchema } from "../parceiros/schemas";
import {
	nfcom_faturasStatusSchema,
	nfcom_faturasTipoDeFaturamentoSchema,
} from "./labels";

export const TABLE_NAME = "t_nfcom_faturas";
export const TABLE_LABEL = "Faturas (NFcom)";

// ============================================================
// BASE SCHEMA (campos escalares)
// ============================================================
export const nfcom_faturasBaseSchema = z.object({
	id: z.number(),
	f_fk_parceiro: z.number(),
	f_data_referencia: z.string(),
	f_data_vencimento: z.string(),
	f_status: nfcom_faturasStatusSchema,
	f_tipo_de_faturamento: nfcom_faturasTipoDeFaturamentoSchema,
	f_valor_total: z.number(),
	updatedAt: z.string(),
	updatedById: z.string(),
	createdAt: z.string(),
	createdById: z.string(),
});

// ============================================================
// RELATION SCHEMA (campos de relação)
// ============================================================
export const nfcom_faturasRelationSchema = z.object({
	createdBy: z.lazy(() => usersBaseSchema.nullable()),
	f_cobrancas: z.lazy(() => nfcom_cobrancasBaseSchema.array()),
	f_parceiro: z.lazy(() => parceirosBaseSchema.nullable()),
	updatedBy: z.lazy(() => usersBaseSchema.nullable()),
});

export const RELATION_TARGETS = {
	createdBy: "users",
	f_cobrancas: "t_nfcom_cobrancas",
	f_parceiro: "t_parceiros",
	updatedBy: "users",
} as const;

// ============================================================
// SCHEMA PRINCIPAL (validação completa)
// ============================================================
export const nfcom_faturasSchema = nfcom_faturasBaseSchema.extend(
	nfcom_faturasRelationSchema.shape,
);

// ============================================================
// CREATE SCHEMA
// ============================================================
export const nfcom_faturasCreateSchema = nfcom_faturasSchema.omit({
	createdAt: true,
	createdBy: true,
	createdById: true,
	f_cobrancas: true,
	f_parceiro: true,
	id: true,
	updatedAt: true,
	updatedBy: true,
	updatedById: true,
});

// ============================================================
// UPDATE SCHEMA
// ============================================================
export const nfcom_faturasUpdateSchema = nfcom_faturasCreateSchema.partial();
