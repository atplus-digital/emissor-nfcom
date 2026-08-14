/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: pnpm generate-types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */

import { z } from "zod";
import { usersBaseSchema } from "../../users/schemas";
import { nfcom_notasBaseSchema } from "../nfcom-notas/schemas";

export const TABLE_NAME = "t_nfcom_itens";
export const TABLE_LABEL = "Itens Nota (NFcom)";

// ============================================================
// BASE SCHEMA (campos escalares)
// ============================================================
export const nfcom_itensBaseSchema = z.object({
	id: z.number(),
	f_fk_nota_fiscal: z.number(),
	f_aliq_icms: z.number(),
	f_bc_icms: z.number(),
	f_cclass: z.string(),
	f_cfop: z.string(),
	f_codigo: z.string(),
	f_descricao: z.string(),
	f_icms: z.number(),
	f_incide_aliquota: z.boolean(),
	f_item: z.number(),
	f_quantidade: z.number(),
	f_total: z.number(),
	f_unitario: z.number(),
	updatedAt: z.string(),
	updatedById: z.string(),
	createdAt: z.string(),
	createdById: z.string(),
});

// ============================================================
// RELATION SCHEMA (campos de relação)
// ============================================================
export const nfcom_itensRelationSchema = z.object({
	createdBy: z.lazy(() => usersBaseSchema.nullable()),
	f_nota_fiscal: z.lazy(() => nfcom_notasBaseSchema.nullable()),
	updatedBy: z.lazy(() => usersBaseSchema.nullable()),
});

export const RELATION_TARGETS = {
	createdBy: "users",
	f_nota_fiscal: "t_nfcom_notas",
	updatedBy: "users",
} as const;

// ============================================================
// SCHEMA PRINCIPAL (validação completa)
// ============================================================
export const nfcom_itensSchema = nfcom_itensBaseSchema.extend(
	nfcom_itensRelationSchema.shape,
);

// ============================================================
// CREATE SCHEMA
// ============================================================
export const nfcom_itensCreateSchema = nfcom_itensSchema.omit({
	createdAt: true,
	createdBy: true,
	createdById: true,
	f_nota_fiscal: true,
	id: true,
	updatedAt: true,
	updatedBy: true,
	updatedById: true,
});

// ============================================================
// UPDATE SCHEMA
// ============================================================
export const nfcom_itensUpdateSchema = nfcom_itensCreateSchema.partial();
