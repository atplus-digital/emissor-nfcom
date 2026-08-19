/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: bun run generate:types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */

import { z } from "zod";
import { parceirosBaseSchema } from "../../parceiros/schemas";
import { usersBaseSchema } from "../../users/schemas";

export const TABLE_NAME = "t_ip_encaminhamento";
export const TABLE_LABEL = "IP de Encaminhamento";

// ============================================================
// BASE SCHEMA (campos escalares)
// ============================================================
export const ip_encaminhamentoBaseSchema = z.object({
	id: z.number(),
	f_fk_dids: z.number(),
	f_fk_ip_encaminhamento: z.number(),
	f_ip_encaminhamento: z.string(),
	updatedAt: z.string(),
	updatedById: z.string(),
	createdAt: z.string(),
	createdById: z.string(),
});

// ============================================================
// RELATION SCHEMA (campos de relação)
// ============================================================
export const ip_encaminhamentoRelationSchema = z.object({
	createdBy: z.lazy(() => usersBaseSchema.nullable()),
	f_parceiro: z.lazy(() => parceirosBaseSchema.nullable()),
	updatedBy: z.lazy(() => usersBaseSchema.nullable()),
});

export const RELATION_TARGETS = {
	createdBy: "users",
	f_parceiro: "t_parceiros",
	updatedBy: "users",
} as const;

// ============================================================
// SCHEMA PRINCIPAL (validação completa)
// ============================================================
export const ip_encaminhamentoSchema = ip_encaminhamentoBaseSchema.extend(
	ip_encaminhamentoRelationSchema.shape,
);

// ============================================================
// CREATE SCHEMA
// ============================================================
export const ip_encaminhamentoCreateSchema = ip_encaminhamentoSchema.omit({
	createdAt: true,
	createdBy: true,
	createdById: true,
	f_parceiro: true,
	id: true,
	updatedAt: true,
	updatedBy: true,
	updatedById: true,
});

// ============================================================
// UPDATE SCHEMA
// ============================================================
export const ip_encaminhamentoUpdateSchema =
	ip_encaminhamentoCreateSchema.partial();
