/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: bun run generate:types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */

import { z } from "zod";
import { usersBaseSchema } from "../../users/schemas";
import { contratos_ixcBaseSchema } from "../contratos-ixc/schemas";

export const TABLE_NAME = "t_contratos_ixc_geral";
export const TABLE_LABEL = "Contratos IXC Geral";

// ============================================================
// BASE SCHEMA (campos escalares)
// ============================================================
export const contratos_ixc_geralBaseSchema = z.object({
	id: z.number(),
	f_descricao_contrato: z.string(),
	updatedAt: z.string(),
	updatedById: z.string(),
	createdAt: z.string(),
	createdById: z.string(),
});

// ============================================================
// RELATION SCHEMA (campos de relação)
// ============================================================
export const contratos_ixc_geralRelationSchema = z.object({
	createdBy: z.lazy(() => usersBaseSchema.nullable()),
	f_contratos_ixc: z.lazy(() => contratos_ixcBaseSchema.array()),
	updatedBy: z.lazy(() => usersBaseSchema.nullable()),
});

export const RELATION_TARGETS = {
	createdBy: "users",
	f_contratos_ixc: "t_contratos_ixc",
	updatedBy: "users",
} as const;

// ============================================================
// SCHEMA PRINCIPAL (validação completa)
// ============================================================
export const contratos_ixc_geralSchema = contratos_ixc_geralBaseSchema.extend(
	contratos_ixc_geralRelationSchema.shape,
);

// ============================================================
// CREATE SCHEMA
// ============================================================
export const contratos_ixc_geralCreateSchema = contratos_ixc_geralSchema.omit({
	createdAt: true,
	createdBy: true,
	createdById: true,
	f_contratos_ixc: true,
	id: true,
	updatedAt: true,
	updatedBy: true,
	updatedById: true,
});

// ============================================================
// UPDATE SCHEMA
// ============================================================
export const contratos_ixc_geralUpdateSchema =
	contratos_ixc_geralCreateSchema.partial();
