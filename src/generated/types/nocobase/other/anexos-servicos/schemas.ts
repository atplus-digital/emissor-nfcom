/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: pnpm generate-types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */

import { z } from "zod";
import { usersBaseSchema } from "../../users/schemas";

export const TABLE_NAME = "f_anexos_servicos";
export const TABLE_LABEL = "Anexos Serviços";

// ============================================================
// BASE SCHEMA (campos escalares)
// ============================================================
export const f_anexos_servicosBaseSchema = z.object({
	id: z.number(),
	extname: z.string(),
	f_anexos_servicos_fk: z.number(),
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
export const f_anexos_servicosRelationSchema = z.object({
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
export const f_anexos_servicosSchema = f_anexos_servicosBaseSchema.extend(
	f_anexos_servicosRelationSchema.shape,
);

// ============================================================
// CREATE SCHEMA
// ============================================================
export const f_anexos_servicosCreateSchema = f_anexos_servicosSchema.omit({
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
export const f_anexos_servicosUpdateSchema =
	f_anexos_servicosCreateSchema.partial();
