/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: bun run generate:types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */

import { z } from "zod";
import { clientesBaseSchema } from "../../clientes/schemas";
import { usersBaseSchema } from "../../users/schemas";
import { servicos_adicionaisTipoServicoSchema } from "./labels";

export const TABLE_NAME = "t_servicos_adicionais";
export const TABLE_LABEL = "Serviços Adicionais";

// ============================================================
// BASE SCHEMA (campos escalares)
// ============================================================
export const servicos_adicionaisBaseSchema = z.object({
	id: z.number(),
	f_fk_servicos_adicionais: z.number(),
	f_armazenamento: z.number(),
	f_armazenamento_mb: z.string(),
	f_descricao: z.string(),
	f_faixa_fin: z.number(),
	f_faixa_ini: z.number(),
	f_informacoes_acesso: z.string(),
	f_ramais: z.string(),
	f_tipo_servico: servicos_adicionaisTipoServicoSchema,
	f_valor_mensal: z.number(),
	f_valor_pabx: z.string(),
	updatedAt: z.string(),
	updatedById: z.string(),
	createdAt: z.string(),
	createdById: z.string(),
});

// ============================================================
// RELATION SCHEMA (campos de relação)
// ============================================================
export const servicos_adicionaisRelationSchema = z.object({
	createdBy: z.lazy(() => usersBaseSchema.nullable()),
	f_clientes_contratos: z.lazy(() => clientesBaseSchema.nullable()),
	updatedBy: z.lazy(() => usersBaseSchema.nullable()),
});

export const RELATION_TARGETS = {
	createdBy: "users",
	f_clientes_contratos: "t_clientes",
	updatedBy: "users",
} as const;

// ============================================================
// SCHEMA PRINCIPAL (validação completa)
// ============================================================
export const servicos_adicionaisSchema = servicos_adicionaisBaseSchema.extend(
	servicos_adicionaisRelationSchema.shape,
);

// ============================================================
// CREATE SCHEMA
// ============================================================
export const servicos_adicionaisCreateSchema = servicos_adicionaisSchema.omit({
	createdAt: true,
	createdBy: true,
	createdById: true,
	f_clientes_contratos: true,
	id: true,
	updatedAt: true,
	updatedBy: true,
	updatedById: true,
});

// ============================================================
// UPDATE SCHEMA
// ============================================================
export const servicos_adicionaisUpdateSchema =
	servicos_adicionaisCreateSchema.partial();
