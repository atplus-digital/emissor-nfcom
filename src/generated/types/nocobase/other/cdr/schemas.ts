/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: pnpm generate-types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */

import { z } from "zod";
import { usersBaseSchema } from "../../users/schemas";
import { linhas_fixasBaseSchema } from "../linhas-fixas/schemas";

export const TABLE_NAME = "t_cdr";
export const TABLE_LABEL = "CDR";

// ============================================================
// BASE SCHEMA (campos escalares)
// ============================================================
export const cdrBaseSchema = z.object({
	id: z.number(),
	f_fk_cdr: z.number(),
	f_accountcode: z.string(),
	f_call_start_time: z.string(),
	f_destino: z.string(),
	f_direcao: z.string(),
	f_duracao: z.number(),
	f_origem: z.string(),
	f_preco: z.number(),
	f_tarifa: z.number(),
	f_tipo: z.string(),
	updatedAt: z.string(),
	updatedById: z.string(),
	createdAt: z.string(),
	createdById: z.string(),
});

// ============================================================
// RELATION SCHEMA (campos de relação)
// ============================================================
export const cdrRelationSchema = z.object({
	createdBy: z.lazy(() => usersBaseSchema.nullable()),
	f_fk_servico: z.lazy(() => linhas_fixasBaseSchema.nullable()),
	updatedBy: z.lazy(() => usersBaseSchema.nullable()),
});

export const RELATION_TARGETS = {
	createdBy: "users",
	f_fk_servico: "t_linhas_fixas",
	updatedBy: "users",
} as const;

// ============================================================
// SCHEMA PRINCIPAL (validação completa)
// ============================================================
export const cdrSchema = cdrBaseSchema.extend(cdrRelationSchema.shape);

// ============================================================
// CREATE SCHEMA
// ============================================================
export const cdrCreateSchema = cdrSchema.omit({
	createdAt: true,
	createdBy: true,
	createdById: true,
	f_fk_servico: true,
	id: true,
	updatedAt: true,
	updatedBy: true,
	updatedById: true,
});

// ============================================================
// UPDATE SCHEMA
// ============================================================
export const cdrUpdateSchema = cdrCreateSchema.partial();
