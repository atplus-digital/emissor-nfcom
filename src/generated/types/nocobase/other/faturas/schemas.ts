/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: pnpm generate-types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */

import { z } from "zod";
import { usersBaseSchema } from "../../users/schemas";
import { parceirosBaseSchema } from "../parceiros/schemas";
import {
	faturasStatusSchema,
	faturasSubstatusSchema,
	faturasTipoDeCobrancaSchema,
} from "./labels";

export const TABLE_NAME = "t_faturas";
export const TABLE_LABEL = "Faturas";

// ============================================================
// BASE SCHEMA (campos escalares)
// ============================================================
export const faturasBaseSchema = z.object({
	id: z.number(),
	f_fk_parceiros: z.number(),
	f_data_emissao: z.string(),
	f_data_vencimento: z.string(),
	f_descricao: z.string(),
	f_id_externo: z.string(),
	f_link_fatura: z.string(),
	f_status: faturasStatusSchema,
	f_substatus: faturasSubstatusSchema,
	f_tipo_de_cobranca: faturasTipoDeCobrancaSchema,
	f_valor_total: z.number(),
	updatedAt: z.string(),
	updatedById: z.string(),
	createdAt: z.string(),
	createdById: z.string(),
});

// ============================================================
// RELATION SCHEMA (campos de relação)
// ============================================================
export const faturasRelationSchema = z.object({
	createdBy: z.lazy(() => usersBaseSchema.nullable()),
	f_parceiros: z.lazy(() => parceirosBaseSchema.nullable()),
	updatedBy: z.lazy(() => usersBaseSchema.nullable()),
});

export const RELATION_TARGETS = {
	createdBy: "users",
	f_parceiros: "t_parceiros",
	updatedBy: "users",
} as const;

// ============================================================
// SCHEMA PRINCIPAL (validação completa)
// ============================================================
export const faturasSchema = faturasBaseSchema.extend(
	faturasRelationSchema.shape,
);

// ============================================================
// CREATE SCHEMA
// ============================================================
export const faturasCreateSchema = faturasSchema.omit({
	createdAt: true,
	createdBy: true,
	createdById: true,
	f_parceiros: true,
	id: true,
	updatedAt: true,
	updatedBy: true,
	updatedById: true,
});

// ============================================================
// UPDATE SCHEMA
// ============================================================
export const faturasUpdateSchema = faturasCreateSchema.partial();
