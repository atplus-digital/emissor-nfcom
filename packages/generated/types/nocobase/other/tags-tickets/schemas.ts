/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: bun run generate:types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */

import { z } from "zod";
import { usersBaseSchema } from "../../users/schemas";

export const TABLE_NAME = "t_tags_tickets";
export const TABLE_LABEL = "Tags - Tickets";

// ============================================================
// BASE SCHEMA (campos escalares)
// ============================================================
export const tags_ticketsBaseSchema = z.object({
	id: z.number(),
	f_fk_tickets: z.number(),
	f_descricao: z.string(),
	f_fk2_tickets: z.number(),
	updatedAt: z.string(),
	updatedById: z.string(),
	createdAt: z.string(),
	createdById: z.string(),
});

// ============================================================
// RELATION SCHEMA (campos de relação)
// ============================================================
export const tags_ticketsRelationSchema = z.object({
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
export const tags_ticketsSchema = tags_ticketsBaseSchema.extend(
	tags_ticketsRelationSchema.shape,
);

// ============================================================
// CREATE SCHEMA
// ============================================================
export const tags_ticketsCreateSchema = tags_ticketsSchema.omit({
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
export const tags_ticketsUpdateSchema = tags_ticketsCreateSchema.partial();
