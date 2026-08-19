/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: bun run generate:types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */

import { z } from "zod";
import { usersBaseSchema } from "../../users/schemas";

export const TABLE_NAME = "t_linha_digitavel_pix";
export const TABLE_LABEL = "Dados - Linha Digitável PIX";

// ============================================================
// BASE SCHEMA (campos escalares)
// ============================================================
export const linha_digitavel_pixBaseSchema = z.object({
	id: z.number(),
	f_id_contrato: z.string(),
	f_id_fatura: z.string(),
	f_linha_digitavel: z.string(),
	updatedAt: z.string(),
	updatedById: z.string(),
	createdAt: z.string(),
	createdById: z.string(),
});

// ============================================================
// RELATION SCHEMA (campos de relação)
// ============================================================
export const linha_digitavel_pixRelationSchema = z.object({
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
export const linha_digitavel_pixSchema = linha_digitavel_pixBaseSchema.extend(
	linha_digitavel_pixRelationSchema.shape,
);

// ============================================================
// CREATE SCHEMA
// ============================================================
export const linha_digitavel_pixCreateSchema = linha_digitavel_pixSchema.omit({
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
export const linha_digitavel_pixUpdateSchema =
	linha_digitavel_pixCreateSchema.partial();
