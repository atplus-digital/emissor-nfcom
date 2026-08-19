/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: bun run generate:types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */

import { z } from "zod";
import { linhas_fixasBaseSchema } from "../linhas-fixas/schemas";
import { didsBaseSchema } from "../other/dids/schemas";
import { servicos_adicionaisBaseSchema } from "../other/servicos-adicionais/schemas";
import { parceirosBaseSchema } from "../parceiros/schemas";
import { usersBaseSchema } from "../users/schemas";
import { clientesTipoAssinanteSchema } from "./labels";

export const TABLE_NAME = "t_clientes";
export const TABLE_LABEL = "Clientes (Contratos)";

// ============================================================
// BASE SCHEMA (campos escalares)
// ============================================================
export const clientesBaseSchema = z.object({
	id: z.number(),
	f_fk_parceiro: z.number(),
	f_fk_servicos_adicionais: z.number(),
	f_area_local: z.string(),
	f_bairro: z.string(),
	f_cep: z.string(),
	f_cidade: z.string(),
	f_codigo_area_local: z.string(),
	f_codigo_cnl: z.string(),
	f_cpf_cnpj: z.string(),
	f_email: z.string(),
	f_endereco: z.string(),
	f_fantasia: z.string(),
	f_nome_razao: z.string(),
	f_numero: z.string(),
	f_rg_ie: z.string(),
	f_telefone: z.string(),
	f_tipo_assinante: clientesTipoAssinanteSchema,
	f_uf: z.string(),
	updatedAt: z.string(),
	updatedById: z.string(),
	createdAt: z.string(),
	createdById: z.string(),
});

// ============================================================
// RELATION SCHEMA (campos de relação)
// ============================================================
export const clientesRelationSchema = z.object({
	createdBy: z.lazy(() => usersBaseSchema.nullable()),
	f_dids: z.lazy(() => didsBaseSchema.array()),
	f_linhas_fixas: z.lazy(() => linhas_fixasBaseSchema.array()),
	f_parceiro: z.lazy(() => parceirosBaseSchema.nullable()),
	f_servicos_adicionais: z.lazy(() => servicos_adicionaisBaseSchema.array()),
	updatedBy: z.lazy(() => usersBaseSchema.nullable()),
});

export const RELATION_TARGETS = {
	createdBy: "users",
	f_dids: "t_dids",
	f_linhas_fixas: "t_linhas_fixas",
	f_parceiro: "t_parceiros",
	f_servicos_adicionais: "t_servicos_adicionais",
	updatedBy: "users",
} as const;

// ============================================================
// SCHEMA PRINCIPAL (validação completa)
// ============================================================
export const clientesSchema = clientesBaseSchema.extend(
	clientesRelationSchema.shape,
);

// ============================================================
// CREATE SCHEMA
// ============================================================
export const clientesCreateSchema = clientesSchema.omit({
	createdAt: true,
	createdBy: true,
	createdById: true,
	f_dids: true,
	f_linhas_fixas: true,
	f_parceiro: true,
	f_servicos_adicionais: true,
	id: true,
	updatedAt: true,
	updatedBy: true,
	updatedById: true,
});

// ============================================================
// UPDATE SCHEMA
// ============================================================
export const clientesUpdateSchema = clientesCreateSchema.partial();
