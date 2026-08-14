/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: pnpm generate-types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */

import { z } from "zod";
import { usersBaseSchema } from "../../users/schemas";
import { cdrBaseSchema } from "../cdr/schemas";
import { clientesBaseSchema } from "../clientes/schemas";
import { didsBaseSchema } from "../dids/schemas";
import { planos_de_servicoBaseSchema } from "../planos-de-servico/schemas";
import {
	linhas_fixasPortabilidadeSchema,
	linhas_fixasStatusSchema,
} from "./labels";

export const TABLE_NAME = "t_linhas_fixas";
export const TABLE_LABEL = "Serviços";

// ============================================================
// BASE SCHEMA (campos escalares)
// ============================================================
export const linhas_fixasBaseSchema = z.object({
	id: z.number(),
	f_fk_linhas_fixas: z.number(),
	f_assinatura: z.number(),
	f_canais: z.number(),
	f_coghzwfvcnx: z.number(),
	f_data_ativacao: z.string(),
	f_motivo_recusa: z.string(),
	f_n_contrato: z.string(),
	f_obs_portabilidade: z.string(),
	f_portabilidade: linhas_fixasPortabilidadeSchema,
	f_qtde_servicos: z.number(),
	f_status: linhas_fixasStatusSchema,
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
export const linhas_fixasRelationSchema = z.object({
	createdBy: z.lazy(() => usersBaseSchema.nullable()),
	f_cdr: z.lazy(() => cdrBaseSchema.array()),
	f_dids: z.lazy(() => didsBaseSchema.array()),
	f_fk_cliente: z.lazy(() => clientesBaseSchema.nullable()),
	f_planos_de_servico: z.lazy(() => planos_de_servicoBaseSchema.nullable()),
	updatedBy: z.lazy(() => usersBaseSchema.nullable()),
});

export const RELATION_TARGETS = {
	createdBy: "users",
	f_cdr: "t_cdr",
	f_dids: "t_dids",
	f_fk_cliente: "t_clientes",
	f_planos_de_servico: "t_planos_de_servico",
	updatedBy: "users",
} as const;

// ============================================================
// SCHEMA PRINCIPAL (validação completa)
// ============================================================
export const linhas_fixasSchema = linhas_fixasBaseSchema.extend(
	linhas_fixasRelationSchema.shape,
);

// ============================================================
// CREATE SCHEMA
// ============================================================
export const linhas_fixasCreateSchema = linhas_fixasSchema.omit({
	createdAt: true,
	createdBy: true,
	createdById: true,
	f_cdr: true,
	f_dids: true,
	f_fk_cliente: true,
	f_planos_de_servico: true,
	id: true,
	updatedAt: true,
	updatedBy: true,
	updatedById: true,
});

// ============================================================
// UPDATE SCHEMA
// ============================================================
export const linhas_fixasUpdateSchema = linhas_fixasCreateSchema.partial();
