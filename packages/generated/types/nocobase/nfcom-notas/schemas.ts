/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: bun run generate:types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */

import { z } from "zod";
import { nfcom_cobrancasBaseSchema } from "../nfcom-cobrancas/schemas";
import { nfcom_errosBaseSchema } from "../nfcom-erros/schemas";
import { nfcom_itensBaseSchema } from "../nfcom-itens/schemas";
import { usersBaseSchema } from "../users/schemas";
import { nfcom_notasStatusInternoSchema } from "./labels";

export const TABLE_NAME = "t_nfcom_notas";
export const TABLE_LABEL = "Notas Fiscais (NFCOM)";

// ============================================================
// BASE SCHEMA (campos escalares)
// ============================================================
export const nfcom_notasBaseSchema = z.object({
	id: z.number(),
	f_fk_cobranca: z.number(),
	f_ambiente: z.number(),
	f_bairro: z.string(),
	f_bc_icms: z.number(),
	f_cep: z.string(),
	f_chave: z.string(),
	f_cidade: z.string(),
	f_codigobarras: z.string(),
	f_cpfcnpj: z.string(),
	f_email: z.string(),
	f_emissao: z.string(),
	f_endereco: z.string(),
	f_endereco_numero: z.string(),
	f_icms: z.number(),
	f_linhadigitavel: z.string(),
	f_mensagem: z.string(),
	f_nome: z.string(),
	f_numero: z.number(),
	f_pdf: z.string(),
	f_protocolo: z.string(),
	f_qrcodepix: z.string(),
	f_rgie: z.string(),
	f_serie: z.number(),
	f_situacao: z.string(),
	f_status_interno: nfcom_notasStatusInternoSchema,
	f_telefone: z.string(),
	f_total: z.number(),
	f_uf: z.string(),
	f_xml: z.string(),
	updatedAt: z.string(),
	updatedById: z.string(),
	createdAt: z.string(),
	createdById: z.string(),
});

// ============================================================
// RELATION SCHEMA (campos de relação)
// ============================================================
export const nfcom_notasRelationSchema = z.object({
	createdBy: z.lazy(() => usersBaseSchema.nullable()),
	f_cobranca: z.lazy(() => nfcom_cobrancasBaseSchema.nullable()),
	f_erro: z.lazy(() => nfcom_errosBaseSchema.nullable()),
	f_nota_itens: z.lazy(() => nfcom_itensBaseSchema.array()),
	updatedBy: z.lazy(() => usersBaseSchema.nullable()),
});

export const RELATION_TARGETS = {
	createdBy: "users",
	f_cobranca: "t_nfcom_cobrancas",
	f_erro: "t_nfcom_erros",
	f_nota_itens: "t_nfcom_itens",
	updatedBy: "users",
} as const;

// ============================================================
// SCHEMA PRINCIPAL (validação completa)
// ============================================================
export const nfcom_notasSchema = nfcom_notasBaseSchema.extend(
	nfcom_notasRelationSchema.shape,
);

// ============================================================
// CREATE SCHEMA
// ============================================================
export const nfcom_notasCreateSchema = nfcom_notasSchema.omit({
	createdAt: true,
	createdBy: true,
	createdById: true,
	f_cobranca: true,
	f_erro: true,
	f_nota_itens: true,
	id: true,
	updatedAt: true,
	updatedBy: true,
	updatedById: true,
});

// ============================================================
// UPDATE SCHEMA
// ============================================================
export const nfcom_notasUpdateSchema = nfcom_notasCreateSchema.partial();
