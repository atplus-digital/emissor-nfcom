/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: pnpm generate-types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */

import { z } from "zod";
import { usersBaseSchema } from "../../users/schemas";
import { anexos_respostasBaseSchema } from "../anexos-respostas/schemas";
import { templates_ticketsBaseSchema } from "../templates-tickets/schemas";

export const TABLE_NAME = "t_respostas";
export const TABLE_LABEL = "Respostas";

// ============================================================
// BASE SCHEMA (campos escalares)
// ============================================================
export const respostasBaseSchema = z.object({
	id: z.number(),
	f_fk_respostas: z.number(),
	f_fk_templates_tickets: z.number(),
	f_fk_tickets: z.number(),
	f_respostas: z.string(),
	updatedAt: z.string(),
	updatedById: z.string(),
	createdAt: z.string(),
	createdById: z.string(),
});

// ============================================================
// RELATION SCHEMA (campos de relação)
// ============================================================
export const respostasRelationSchema = z.object({
	createdBy: z.lazy(() => usersBaseSchema.nullable()),
	f_anexos: z.lazy(() => anexos_respostasBaseSchema.array()),
	f_templates_tickets: z.lazy(() => templates_ticketsBaseSchema.nullable()),
	updatedBy: z.lazy(() => usersBaseSchema.nullable()),
});

export const RELATION_TARGETS = {
	createdBy: "users",
	f_anexos: "t_anexos_respostas",
	f_templates_tickets: "t_templates_tickets",
	updatedBy: "users",
} as const;

// ============================================================
// SCHEMA PRINCIPAL (validação completa)
// ============================================================
export const respostasSchema = respostasBaseSchema.extend(
	respostasRelationSchema.shape,
);

// ============================================================
// CREATE SCHEMA
// ============================================================
export const respostasCreateSchema = respostasSchema.omit({
	createdAt: true,
	createdBy: true,
	createdById: true,
	f_anexos: true,
	f_templates_tickets: true,
	id: true,
	updatedAt: true,
	updatedBy: true,
	updatedById: true,
});

// ============================================================
// UPDATE SCHEMA
// ============================================================
export const respostasUpdateSchema = respostasCreateSchema.partial();
