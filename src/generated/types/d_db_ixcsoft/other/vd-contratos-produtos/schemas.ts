/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: pnpm generate-types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */

import { z } from "zod";
import {
	vd_contratos_produtosDescontoProporcionalSchema,
	vd_contratos_produtosRepetirSchema,
	vd_contratos_produtosTipoDescontoSchema,
	vd_contratos_produtosTipoSchema,
} from "./labels";

export const TABLE_NAME = "vd_contratos_produtos";
export const TABLE_LABEL = "vd_contratos_produtos";

// ============================================================
// BASE SCHEMA (campos escalares)
// ============================================================
export const vd_contratos_produtosBaseSchema = z.object({
	id: z.number(),
	atualizado_por: z.number(),
	desconto_percentual: z.number(),
	desconto_proporcional: vd_contratos_produtosDescontoProporcionalSchema,
	descricao: z.string(),
	descricao_plano_valor_1: z.number(),
	descricao_plano_valor_2: z.number(),
	fixar_ip: z.number(),
	id_contrato: z.number(),
	id_contrato_produto_plano: z.number(),
	id_plano: z.number(),
	id_produto: z.number(),
	id_tipo_documento: z.number(),
	id_unidade: z.number(),
	id_vd_contrato: z.number(),
	inserido_em: z.string(),
	inserido_por: z.number(),
	limite_pacote: z.number(),
	logins_simultaneos: z.number(),
	obs: z.string(),
	qtde: z.number(),
	qtde_repeticoes_desconto_produto: z.number(),
	repetir: vd_contratos_produtosRepetirSchema,
	repetir_qtde: z.number(),
	tipo: vd_contratos_produtosTipoSchema,
	tipo_desconto: vd_contratos_produtosTipoDescontoSchema,
	tv_pacotes_canais: z.string(),
	ultima_atualizacao: z.string(),
	valor_adicional_pacote: z.number(),
	valor_ate_vencimento: z.number(),
	valor_desconto_produto: z.number(),
	valor_unit: z.number(),
});

export const RELATION_TARGETS = {} as const;

// ============================================================
// SCHEMA PRINCIPAL (validação completa)
// ============================================================
export const vd_contratos_produtosSchema = vd_contratos_produtosBaseSchema;

// ============================================================
// CREATE SCHEMA
// ============================================================
export const vd_contratos_produtosCreateSchema =
	vd_contratos_produtosSchema.omit({
		id: true,
	});

// ============================================================
// UPDATE SCHEMA
// ============================================================
export const vd_contratos_produtosUpdateSchema =
	vd_contratos_produtosCreateSchema.partial();
