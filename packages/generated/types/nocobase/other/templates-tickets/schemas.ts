/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: bun run generate:types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */

import { z } from "zod";
import { usersBaseSchema } from "../../users/schemas";

export const TABLE_NAME = "t_templates_tickets";
export const TABLE_LABEL = "Templates (RESPOSTAS TICKETS)";

// ============================================================
// BASE SCHEMA (campos escalares)
// ============================================================
export const templates_ticketsBaseSchema = z.object({
	id: z.number(),
	f_fk_respostas_tickets: z.number(),
	f_resposta: z.string(),
	f_titulo: z.string(),
	updatedAt: z.string(),
	updatedById: z.string(),
	createdAt: z.string(),
	createdById: z.string(),
});

// ============================================================
// RELATION SCHEMA (campos de relação)
// ============================================================
export const templates_ticketsRelationSchema = z.object({
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
export const templates_ticketsSchema = templates_ticketsBaseSchema.extend(
	templates_ticketsRelationSchema.shape,
);

// ============================================================
// CREATE SCHEMA
// ============================================================
export const templates_ticketsCreateSchema = templates_ticketsSchema.omit({
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
export const templates_ticketsUpdateSchema =
	templates_ticketsCreateSchema.partial();
