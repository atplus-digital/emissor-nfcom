/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: pnpm generate-types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */

import { z } from "zod";
import { usersBaseSchema } from "../../users/schemas";
import { nfcom_cobrancasBaseSchema } from "../nfcom-cobrancas/schemas";

export const TABLE_NAME = "t_nfcom_itens_adicionais";
export const TABLE_LABEL = "Itens Adicionais";

// ============================================================
// BASE SCHEMA (campos escalares)
// ============================================================
export const nfcom_itens_adicionaisBaseSchema = z.object({
	id: z.number(),
	f_fk_cobranca: z.number(),
	updatedAt: z.string(),
	updatedById: z.string(),
	createdAt: z.string(),
	createdById: z.string(),
});

// ============================================================
// RELATION SCHEMA (campos de relação)
// ============================================================
export const nfcom_itens_adicionaisRelationSchema = z.object({
	createdBy: z.lazy(() => usersBaseSchema.nullable()),
	f_cobranca: z.lazy(() => nfcom_cobrancasBaseSchema.nullable()),
	updatedBy: z.lazy(() => usersBaseSchema.nullable()),
});

export const RELATION_TARGETS = {
	createdBy: "users",
	f_cobranca: "t_nfcom_cobrancas",
	updatedBy: "users",
} as const;

// ============================================================
// SCHEMA PRINCIPAL (validação completa)
// ============================================================
export const nfcom_itens_adicionaisSchema =
	nfcom_itens_adicionaisBaseSchema.extend(
		nfcom_itens_adicionaisRelationSchema.shape,
	);

// ============================================================
// CREATE SCHEMA
// ============================================================
export const nfcom_itens_adicionaisCreateSchema =
	nfcom_itens_adicionaisSchema.omit({
		createdAt: true,
		createdBy: true,
		createdById: true,
		f_cobranca: true,
		id: true,
		updatedAt: true,
		updatedBy: true,
		updatedById: true,
	});

// ============================================================
// UPDATE SCHEMA
// ============================================================
export const nfcom_itens_adicionaisUpdateSchema =
	nfcom_itens_adicionaisCreateSchema.partial();
