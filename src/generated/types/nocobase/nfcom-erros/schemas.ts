/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: bun run generate:types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */

import { z } from "zod";
import { nfcom_cobrancasBaseSchema } from "../nfcom-cobrancas/schemas";
import { nfcom_notasBaseSchema } from "../nfcom-notas/schemas";
import { usersBaseSchema } from "../users/schemas";

export const TABLE_NAME = "t_nfcom_erros";
export const TABLE_LABEL = "Erros de Emissão";

// ============================================================
// BASE SCHEMA (campos escalares)
// ============================================================
export const nfcom_errosBaseSchema = z.object({
	id: z.number(),
	f_fk_cobranca: z.number(),
	f_fk_nfcom: z.number(),
	f_erro: z.string(),
	f_mensagem: z.string(),
	f_status_code: z.string(),
	updatedAt: z.string(),
	updatedById: z.string(),
	createdAt: z.string(),
	createdById: z.string(),
});

// ============================================================
// RELATION SCHEMA (campos de relação)
// ============================================================
export const nfcom_errosRelationSchema = z.object({
	createdBy: z.lazy(() => usersBaseSchema.nullable()),
	f_cobranca: z.lazy(() => nfcom_cobrancasBaseSchema.nullable()),
	f_nfcom: z.lazy(() => nfcom_notasBaseSchema.nullable()),
	updatedBy: z.lazy(() => usersBaseSchema.nullable()),
});

export const RELATION_TARGETS = {
	createdBy: "users",
	f_cobranca: "t_nfcom_cobrancas",
	f_nfcom: "t_nfcom_notas",
	updatedBy: "users",
} as const;

// ============================================================
// SCHEMA PRINCIPAL (validação completa)
// ============================================================
export const nfcom_errosSchema = nfcom_errosBaseSchema.extend(
	nfcom_errosRelationSchema.shape,
);

// ============================================================
// CREATE SCHEMA
// ============================================================
export const nfcom_errosCreateSchema = nfcom_errosSchema.omit({
	createdAt: true,
	createdBy: true,
	createdById: true,
	f_cobranca: true,
	f_nfcom: true,
	id: true,
	updatedAt: true,
	updatedBy: true,
	updatedById: true,
});

// ============================================================
// UPDATE SCHEMA
// ============================================================
export const nfcom_errosUpdateSchema = nfcom_errosCreateSchema.partial();
