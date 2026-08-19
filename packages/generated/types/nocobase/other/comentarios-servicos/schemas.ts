/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: bun run generate:types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */

import { z } from "zod";
import { usersBaseSchema } from "../../users/schemas";
import { f_anexos_servicosBaseSchema } from "../anexos-servicos/schemas";

export const TABLE_NAME = "t_comentarios_servicos";
export const TABLE_LABEL = "Comentários Serviços";

// ============================================================
// BASE SCHEMA (campos escalares)
// ============================================================
export const comentarios_servicosBaseSchema = z.object({
	id: z.number(),
	f_fk_servicos: z.number(),
	f_comentario: z.string(),
	updatedAt: z.string(),
	updatedById: z.string(),
	createdAt: z.string(),
	createdById: z.string(),
});

// ============================================================
// RELATION SCHEMA (campos de relação)
// ============================================================
export const comentarios_servicosRelationSchema = z.object({
	createdBy: z.lazy(() => usersBaseSchema.nullable()),
	f_anexos_servicos_fk: z.lazy(() => f_anexos_servicosBaseSchema.array()),
	updatedBy: z.lazy(() => usersBaseSchema.nullable()),
});

export const RELATION_TARGETS = {
	createdBy: "users",
	f_anexos_servicos_fk: "f_anexos_servicos",
	updatedBy: "users",
} as const;

// ============================================================
// SCHEMA PRINCIPAL (validação completa)
// ============================================================
export const comentarios_servicosSchema = comentarios_servicosBaseSchema.extend(
	comentarios_servicosRelationSchema.shape,
);

// ============================================================
// CREATE SCHEMA
// ============================================================
export const comentarios_servicosCreateSchema = comentarios_servicosSchema.omit(
	{
		createdAt: true,
		createdBy: true,
		createdById: true,
		f_anexos_servicos_fk: true,
		id: true,
		updatedAt: true,
		updatedBy: true,
		updatedById: true,
	},
);

// ============================================================
// UPDATE SCHEMA
// ============================================================
export const comentarios_servicosUpdateSchema =
	comentarios_servicosCreateSchema.partial();
