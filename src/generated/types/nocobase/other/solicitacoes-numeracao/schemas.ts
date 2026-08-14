/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: pnpm generate-types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */

import { z } from "zod";
import { usersBaseSchema } from "../../users/schemas";
import { clientesBaseSchema } from "../clientes/schemas";
import { planos_de_servicoBaseSchema } from "../planos-de-servico/schemas";
import { solicitacoes_numeracaoPortabilidadeSchema } from "./labels";

export const TABLE_NAME = "t_solicitacoes_numeracao";
export const TABLE_LABEL = "Solicitações de Numeração";

// ============================================================
// BASE SCHEMA (campos escalares)
// ============================================================
export const solicitacoes_numeracaoBaseSchema = z.object({
	id: z.number(),
	f_fk_contrato: z.number(),
	f_fk_servico: z.number(),
	f_canais: z.number(),
	f_portabilidade: solicitacoes_numeracaoPortabilidadeSchema,
	f_solicitacoes_de_numeracao: z.number(),
	f_terminal: z.string(),
	f_terminal_final: z.string(),
	f_terminal_inicial: z.string(),
	updatedAt: z.string(),
	updatedById: z.string(),
	createdAt: z.string(),
	createdById: z.string(),
});

// ============================================================
// RELATION SCHEMA (campos de relação)
// ============================================================
export const solicitacoes_numeracaoRelationSchema = z.object({
	createdBy: z.lazy(() => usersBaseSchema.nullable()),
	f_contrato: z.lazy(() => clientesBaseSchema.nullable()),
	f_servico: z.lazy(() => planos_de_servicoBaseSchema.nullable()),
	updatedBy: z.lazy(() => usersBaseSchema.nullable()),
});

export const RELATION_TARGETS = {
	createdBy: "users",
	f_contrato: "t_clientes",
	f_servico: "t_planos_de_servico",
	updatedBy: "users",
} as const;

// ============================================================
// SCHEMA PRINCIPAL (validação completa)
// ============================================================
export const solicitacoes_numeracaoSchema =
	solicitacoes_numeracaoBaseSchema.extend(
		solicitacoes_numeracaoRelationSchema.shape,
	);

// ============================================================
// CREATE SCHEMA
// ============================================================
export const solicitacoes_numeracaoCreateSchema =
	solicitacoes_numeracaoSchema.omit({
		createdAt: true,
		createdBy: true,
		createdById: true,
		f_contrato: true,
		f_servico: true,
		id: true,
		updatedAt: true,
		updatedBy: true,
		updatedById: true,
	});

// ============================================================
// UPDATE SCHEMA
// ============================================================
export const solicitacoes_numeracaoUpdateSchema =
	solicitacoes_numeracaoCreateSchema.partial();
