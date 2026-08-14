/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: pnpm generate-types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */

import { z } from "zod";
import { usersBaseSchema } from "../../users/schemas";

export const TABLE_NAME = "t_anexos_respostas";
export const TABLE_LABEL = "Anexos Respostas";

// ============================================================
// BASE SCHEMA (campos escalares)
// ============================================================
export const anexos_respostasBaseSchema = z.object({
	id: z.number(),
	f_fk_respostas: z.number(),
	extname: z.string(),
	filename: z.string(),
	meta: z.string(),
	mimetype: z.string(),
	path: z.string(),
	preview: z.string(),
	size: z.number(),
	storageId: z.number(),
	title: z.string(),
	url: z.string(),
	updatedAt: z.string(),
	updatedById: z.string(),
	createdAt: z.string(),
	createdById: z.string(),
});

// ============================================================
// RELATION SCHEMA (campos de relação)
// ============================================================
export const anexos_respostasRelationSchema = z.object({
	createdBy: z.lazy(() => usersBaseSchema.nullable()),
	storage: z.number().nullable(),
	updatedBy: z.lazy(() => usersBaseSchema.nullable()),
});

export const RELATION_TARGETS = {
	createdBy: "users",
	updatedBy: "users",
} as const;

// ============================================================
// SCHEMA PRINCIPAL (validação completa)
// ============================================================
export const anexos_respostasSchema = anexos_respostasBaseSchema.extend(
	anexos_respostasRelationSchema.shape,
);

// ============================================================
// CREATE SCHEMA
// ============================================================
export const anexos_respostasCreateSchema = anexos_respostasSchema.omit({
	createdAt: true,
	createdBy: true,
	createdById: true,
	id: true,
	storage: true,
	updatedAt: true,
	updatedBy: true,
	updatedById: true,
});

// ============================================================
// UPDATE SCHEMA
// ============================================================
export const anexos_respostasUpdateSchema =
	anexos_respostasCreateSchema.partial();
