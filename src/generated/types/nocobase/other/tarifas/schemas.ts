/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: pnpm generate-types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */

import { z } from "zod";
import { usersBaseSchema } from "../../users/schemas";
import { tarifasTipoSchema } from "./labels";

export const TABLE_NAME = "t_tarifas";
export const TABLE_LABEL = "Tarifas";

// ============================================================
// BASE SCHEMA (campos escalares)
// ============================================================
export const tarifasBaseSchema = z.object({
	id: z.number(),
	f_fk_tarifas: z.number(),
	f_tipo: tarifasTipoSchema,
	f_valor: z.number(),
	updatedAt: z.string(),
	updatedById: z.string(),
	createdAt: z.string(),
	createdById: z.string(),
});

// ============================================================
// RELATION SCHEMA (campos de relação)
// ============================================================
export const tarifasRelationSchema = z.object({
	createdBy: z.lazy(() => usersBaseSchema.nullable()),
	updatedBy: z.lazy(() => usersBaseSchema.nullable()),
});

export const RELATION_TARGETS = {
	createdBy: "users",
	updatedBy: "users",
} as const;

// ============================================================
// SCHEMA PRINCIPAL (validação completa)
// ============================================================
export const tarifasSchema = tarifasBaseSchema.extend(
	tarifasRelationSchema.shape,
);

// ============================================================
// CREATE SCHEMA
// ============================================================
export const tarifasCreateSchema = tarifasSchema.omit({
	createdAt: true,
	createdBy: true,
	createdById: true,
	id: true,
	updatedAt: true,
	updatedBy: true,
	updatedById: true,
});

// ============================================================
// UPDATE SCHEMA
// ============================================================
export const tarifasUpdateSchema = tarifasCreateSchema.partial();
