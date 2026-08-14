/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: pnpm generate-types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */

import { z } from "zod";
import { usersBaseSchema } from "../../users/schemas";

export const TABLE_NAME = "t_localidades";
export const TABLE_LABEL = "Localidades";

// ============================================================
// BASE SCHEMA (campos escalares)
// ============================================================
export const localidadesBaseSchema = z.object({
	id: z.number(),
	f_arealocal: z.string(),
	f_estado: z.string(),
	f_municipio: z.string(),
	updatedAt: z.string(),
	updatedById: z.string(),
	createdAt: z.string(),
	createdById: z.string(),
});

// ============================================================
// RELATION SCHEMA (campos de relação)
// ============================================================
export const localidadesRelationSchema = z.object({
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
export const localidadesSchema = localidadesBaseSchema.extend(
	localidadesRelationSchema.shape,
);

// ============================================================
// CREATE SCHEMA
// ============================================================
export const localidadesCreateSchema = localidadesSchema.omit({
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
export const localidadesUpdateSchema = localidadesCreateSchema.partial();
