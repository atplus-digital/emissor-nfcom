/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: bun run generate:types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */

import { z } from "zod";
import { clientesBaseSchema } from "../clientes/schemas";
import { nfcom_faturasBaseSchema } from "../nfcom-faturas/schemas";
import { faturasBaseSchema } from "../other/faturas/schemas";
import { solicitacoes_numeracaoBaseSchema } from "../other/solicitacoes-numeracao/schemas";
import { ticketsBaseSchema } from "../other/tickets/schemas";
import { planos_de_servicoBaseSchema } from "../planos-de-servico/schemas";
import { usersBaseSchema } from "../users/schemas";
import {
	parceirosContratossippulseSchema,
	parceirosIpEncaminhamentoSchema,
} from "./labels";

export const TABLE_NAME = "t_parceiros";
export const TABLE_LABEL = "Parceiros";

// ============================================================
// BASE SCHEMA (campos escalares)
// ============================================================
export const parceirosBaseSchema = z.object({
	id: z.number(),
	f_fk_planos_servico: z.number(),
	f_fk_usuarios: z.number(),
	f_bairro: z.string(),
	f_cep: z.string(),
	f_cidade: z.string(),
	f_cnpj: z.string(),
	f_contratossippulse: parceirosContratossippulseSchema,
	f_data_vencimento: z.number(),
	f_email_faturamento: z.string(),
	f_endereco: z.string(),
	f_fantasia: z.string(),
	f_id_asaas: z.string(),
	f_ie: z.string(),
	f_ip_encaminhamento: parceirosIpEncaminhamentoSchema,
	f_numero: z.string(),
	f_razao_social: z.string(),
	f_telefone: z.number(),
	f_uf: z.string(),
	updatedAt: z.string(),
	updatedById: z.string(),
	createdAt: z.string(),
	createdById: z.string(),
});

// ============================================================
// RELATION SCHEMA (campos de relação)
// ============================================================
export const parceirosRelationSchema = z.object({
	createdBy: z.lazy(() => usersBaseSchema.nullable()),
	f_faturas: z.lazy(() => faturasBaseSchema.array()),
	f_fk_clientes: z.lazy(() => clientesBaseSchema.nullable()),
	f_nfcom_faturas: z.lazy(() => nfcom_faturasBaseSchema.array()),
	f_planos_de_servico: z.lazy(() => planos_de_servicoBaseSchema.array()),
	f_solicitacoes_de_numeracao: z.lazy(() =>
		solicitacoes_numeracaoBaseSchema.array(),
	),
	f_tickets: z.lazy(() => ticketsBaseSchema.array()),
	f_usuarios: z.lazy(() => usersBaseSchema.array()),
	updatedBy: z.lazy(() => usersBaseSchema.nullable()),
});

export const RELATION_TARGETS = {
	createdBy: "users",
	f_faturas: "t_faturas",
	f_fk_clientes: "t_clientes",
	f_nfcom_faturas: "t_nfcom_faturas",
	f_planos_de_servico: "t_planos_de_servico",
	f_solicitacoes_de_numeracao: "t_solicitacoes_numeracao",
	f_tickets: "t_tickets",
	f_usuarios: "users",
	updatedBy: "users",
} as const;

// ============================================================
// SCHEMA PRINCIPAL (validação completa)
// ============================================================
export const parceirosSchema = parceirosBaseSchema.extend(
	parceirosRelationSchema.shape,
);

// ============================================================
// CREATE SCHEMA
// ============================================================
export const parceirosCreateSchema = parceirosSchema.omit({
	createdAt: true,
	createdBy: true,
	createdById: true,
	f_faturas: true,
	f_fk_clientes: true,
	f_nfcom_faturas: true,
	f_planos_de_servico: true,
	f_solicitacoes_de_numeracao: true,
	f_tickets: true,
	f_usuarios: true,
	id: true,
	updatedAt: true,
	updatedBy: true,
	updatedById: true,
});

// ============================================================
// UPDATE SCHEMA
// ============================================================
export const parceirosUpdateSchema = parceirosCreateSchema.partial();
