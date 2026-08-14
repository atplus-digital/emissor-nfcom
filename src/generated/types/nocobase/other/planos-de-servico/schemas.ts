/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: pnpm generate-types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */

import { z } from "zod";
import { usersBaseSchema } from "../../users/schemas";
import { parceirosBaseSchema } from "../parceiros/schemas";
import { tarifasBaseSchema } from "../tarifas/schemas";
import { planos_de_servicoPlanoTarifaSchema } from "./labels";

export const TABLE_NAME = "t_planos_de_servico";
export const TABLE_LABEL = "Planos de Serviço";

// ============================================================
// BASE SCHEMA (campos escalares)
// ============================================================
export const planos_de_servicoBaseSchema = z.object({
	id: z.number(),
	f_fk_planos_de_servico: z.number(),
	f_assinatura_mensal: z.number(),
	f_hl6rivwu39j: z.number(),
	f_luxc5wno255: z.number(),
	f_nome: z.string(),
	f_o0i69g0wqdk: z.number(),
	f_plano: z.string(),
	f_plano_tarifa: planos_de_servicoPlanoTarifaSchema,
	f_quantidade_canais: z.string(),
	f_quantidade_dids: z.string(),
	updatedAt: z.string(),
	updatedById: z.string(),
	createdAt: z.string(),
	createdById: z.string(),
});

// ============================================================
// RELATION SCHEMA (campos de relação)
// ============================================================
export const planos_de_servicoRelationSchema = z.object({
	createdBy: z.lazy(() => usersBaseSchema.nullable()),
	f_c8flsp9105w: z.lazy(() => parceirosBaseSchema.nullable()),
	f_eiyuv62nhru: z.lazy(() => parceirosBaseSchema.array()),
	f_tarifas: z.lazy(() => tarifasBaseSchema.array()),
	updatedBy: z.lazy(() => usersBaseSchema.nullable()),
});

export const RELATION_TARGETS = {
	createdBy: "users",
	f_c8flsp9105w: "t_parceiros",
	f_eiyuv62nhru: "t_parceiros",
	f_tarifas: "t_tarifas",
	updatedBy: "users",
} as const;

// ============================================================
// SCHEMA PRINCIPAL (validação completa)
// ============================================================
export const planos_de_servicoSchema = planos_de_servicoBaseSchema.extend(
	planos_de_servicoRelationSchema.shape,
);

// ============================================================
// CREATE SCHEMA
// ============================================================
export const planos_de_servicoCreateSchema = planos_de_servicoSchema.omit({
	createdAt: true,
	createdBy: true,
	createdById: true,
	f_c8flsp9105w: true,
	f_eiyuv62nhru: true,
	f_tarifas: true,
	id: true,
	updatedAt: true,
	updatedBy: true,
	updatedById: true,
});

// ============================================================
// UPDATE SCHEMA
// ============================================================
export const planos_de_servicoUpdateSchema =
	planos_de_servicoCreateSchema.partial();
