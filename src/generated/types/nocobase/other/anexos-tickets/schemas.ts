/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: pnpm generate-types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */

import { z } from "zod";
import { usersBaseSchema } from "../../users/schemas";

export const TABLE_NAME = "t_anexos_tickets";
export const TABLE_LABEL = "Anexos Tickets";

// ============================================================
// BASE SCHEMA (campos escalares)
// ============================================================
export const anexos_ticketsBaseSchema = z.object({
	id: z.number(),
	extname: z.string(),
	f_anexos_tickets_fk: z.number(),
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
export const anexos_ticketsRelationSchema = z.object({
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
export const anexos_ticketsSchema = anexos_ticketsBaseSchema.extend(
	anexos_ticketsRelationSchema.shape,
);

// ============================================================
// CREATE SCHEMA
// ============================================================
export const anexos_ticketsCreateSchema = anexos_ticketsSchema.omit({
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
export const anexos_ticketsUpdateSchema = anexos_ticketsCreateSchema.partial();
