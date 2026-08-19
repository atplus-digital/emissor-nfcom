/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: bun run generate:types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */

import { z } from "zod";
import { linhas_fixasBaseSchema } from "../../linhas-fixas/schemas";
import { parceirosBaseSchema } from "../../parceiros/schemas";
import { usersBaseSchema } from "../../users/schemas";
import { anexos_portabilidades_didsBaseSchema } from "../anexos-portabilidades-dids/schemas";
import { ip_encaminhamentoBaseSchema } from "../ip-encaminhamento/schemas";
import {
	didsDisponivelVendaSchema,
	didsEncaminhamentoSchema,
	didsProfileSchema,
	didsSecaoDidSchema,
	didsStatusSchema,
} from "./labels";

export const TABLE_NAME = "t_dids";
export const TABLE_LABEL = "DID's";

// ============================================================
// BASE SCHEMA (campos escalares)
// ============================================================
export const didsBaseSchema = z.object({
	id: z.number(),
	f_fk_dids: z.number(),
	f_fk_ip_encaminhamento: z.number(),
	f_fk_parceiros: z.number(),
	f_area_local: z.string(),
	f_codigo_area_local: z.string(),
	f_disponivel_venda: didsDisponivelVendaSchema,
	f_e_ddr: z.boolean(),
	f_encaminhamento: didsEncaminhamentoSchema,
	f_profile: didsProfileSchema,
	f_secao_did: didsSecaoDidSchema,
	f_sigla_area_local: z.string(),
	f_status: didsStatusSchema,
	f_terminal: z.string(),
	f_terminal_final: z.string(),
	updatedAt: z.string(),
	updatedById: z.string(),
	createdAt: z.string(),
	createdById: z.string(),
});

// ============================================================
// RELATION SCHEMA (campos de relação)
// ============================================================
export const didsRelationSchema = z.object({
	createdBy: z.lazy(() => usersBaseSchema.nullable()),
	f_ip_encaminhamento: z.lazy(() => ip_encaminhamentoBaseSchema.nullable()),
	f_p7t1gu76z7p: z.lazy(() => linhas_fixasBaseSchema.nullable()),
	f_parceiros: z.lazy(() => parceirosBaseSchema.nullable()),
	t_anexos_portabilidades_dids: z.lazy(() =>
		anexos_portabilidades_didsBaseSchema.array(),
	),
	updatedBy: z.lazy(() => usersBaseSchema.nullable()),
});

export const RELATION_TARGETS = {
	createdBy: "users",
	f_ip_encaminhamento: "t_ip_encaminhamento",
	f_p7t1gu76z7p: "t_linhas_fixas",
	f_parceiros: "t_parceiros",
	t_anexos_portabilidades_dids: "t_anexos_portabilidades_dids",
	updatedBy: "users",
} as const;

// ============================================================
// SCHEMA PRINCIPAL (validação completa)
// ============================================================
export const didsSchema = didsBaseSchema.extend(didsRelationSchema.shape);

// ============================================================
// CREATE SCHEMA
// ============================================================
export const didsCreateSchema = didsSchema.omit({
	createdAt: true,
	createdBy: true,
	createdById: true,
	f_ip_encaminhamento: true,
	f_p7t1gu76z7p: true,
	f_parceiros: true,
	id: true,
	t_anexos_portabilidades_dids: true,
	updatedAt: true,
	updatedBy: true,
	updatedById: true,
});

// ============================================================
// UPDATE SCHEMA
// ============================================================
export const didsUpdateSchema = didsCreateSchema.partial();
