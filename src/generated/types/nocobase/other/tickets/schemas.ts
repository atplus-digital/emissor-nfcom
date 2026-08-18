/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: bun run generate:types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */

import { z } from "zod";
import { clientesBaseSchema } from "../../clientes/schemas";
import { linhas_fixasBaseSchema } from "../../linhas-fixas/schemas";
import { parceirosBaseSchema } from "../../parceiros/schemas";
import { usersBaseSchema } from "../../users/schemas";
import { anexos_ticketsBaseSchema } from "../anexos-tickets/schemas";
import { localidadesBaseSchema } from "../localidades/schemas";
import { tags_ticketsBaseSchema } from "../tags-tickets/schemas";
import {
	ticketsDepartamentoSchema,
	ticketsStatusSchema,
	ticketsTagsSchema,
	ticketsTipoSolicitacaoSchema,
} from "./labels";

export const TABLE_NAME = "t_tickets";
export const TABLE_LABEL = "Tickets";

// ============================================================
// BASE SCHEMA (campos escalares)
// ============================================================
export const ticketsBaseSchema = z.object({
	id: z.number(),
	f_b2v3ctc7rds: z.number(),
	f_data_teste: z.string(),
	f_departamento: ticketsDepartamentoSchema,
	f_k2gur7mlcvv: z.number(),
	f_mensagem_inicial: z.string(),
	f_na: z.string(),
	f_nb: z.string(),
	f_obs_internas: z.string(),
	f_responsavel: z.number(),
	f_status: ticketsStatusSchema,
	f_tags: ticketsTagsSchema,
	f_tipo_solicitacao: ticketsTipoSolicitacaoSchema,
	f_titulo: z.string(),
	updatedAt: z.string(),
	updatedById: z.string(),
	createdAt: z.string(),
	createdById: z.string(),
});

// ============================================================
// RELATION SCHEMA (campos de relação)
// ============================================================
export const ticketsRelationSchema = z.object({
	createdBy: z.lazy(() => usersBaseSchema.nullable()),
	f_anexos: z.lazy(() => anexos_ticketsBaseSchema.array()),
	f_clientes: z.lazy(() => clientesBaseSchema.array()),
	f_linhasfixas: z.lazy(() => linhas_fixasBaseSchema.array()),
	f_localidades: z.lazy(() => localidadesBaseSchema.nullable()),
	f_parceiro: z.lazy(() => parceirosBaseSchema.nullable()),
	f_responsavel2: z.lazy(() => usersBaseSchema.nullable()),
	f_tags_tickets: z.lazy(() => tags_ticketsBaseSchema.array()),
	updatedBy: z.lazy(() => usersBaseSchema.nullable()),
});

export const RELATION_TARGETS = {
	createdBy: "users",
	f_anexos: "t_anexos_tickets",
	f_clientes: "t_clientes",
	f_linhasfixas: "t_linhas_fixas",
	f_localidades: "t_localidades",
	f_parceiro: "t_parceiros",
	f_responsavel2: "users",
	f_tags_tickets: "t_tags_tickets",
	updatedBy: "users",
} as const;

// ============================================================
// SCHEMA PRINCIPAL (validação completa)
// ============================================================
export const ticketsSchema = ticketsBaseSchema.extend(
	ticketsRelationSchema.shape,
);

// ============================================================
// CREATE SCHEMA
// ============================================================
export const ticketsCreateSchema = ticketsSchema.omit({
	createdAt: true,
	createdBy: true,
	createdById: true,
	f_anexos: true,
	f_clientes: true,
	f_linhasfixas: true,
	f_localidades: true,
	f_parceiro: true,
	f_responsavel2: true,
	f_tags_tickets: true,
	id: true,
	updatedAt: true,
	updatedBy: true,
	updatedById: true,
});

// ============================================================
// UPDATE SCHEMA
// ============================================================
export const ticketsUpdateSchema = ticketsCreateSchema.partial();
