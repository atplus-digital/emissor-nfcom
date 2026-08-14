/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: pnpm generate-types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */

import { z } from "zod";
import { usersBaseSchema } from "../../users/schemas";

export const TABLE_NAME = "t_contato";
export const TABLE_LABEL = "Contato";

// ============================================================
// BASE SCHEMA (campos escalares)
// ============================================================
export const contatoBaseSchema = z.object({
	id: z.number(),
	f_id_cliente: z.string(),
	f_id_contrato: z.string(),
	f_responsavel: z.string(),
	f_telefone: z.string(),
	updatedAt: z.string(),
	updatedById: z.string(),
	createdAt: z.string(),
	createdById: z.string(),
});

// ============================================================
// RELATION SCHEMA (campos de relação)
// ============================================================
export const contatoRelationSchema = z.object({
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
export const contatoSchema = contatoBaseSchema.extend(
	contatoRelationSchema.shape,
);

// ============================================================
// CREATE SCHEMA
// ============================================================
export const contatoCreateSchema = contatoSchema.omit({
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
export const contatoUpdateSchema = contatoCreateSchema.partial();
