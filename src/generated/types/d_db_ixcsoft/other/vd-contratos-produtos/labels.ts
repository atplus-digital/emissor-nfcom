/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: pnpm generate-types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */

import { z } from "zod";

// ============================================================
// LABELS (single source of truth)
// ============================================================
export const VD_CONTRATOS_PRODUTOS_FIELD_LABELS = {
	atualizado_por: "atualizado_por",
	desconto_percentual: "desconto_percentual",
	desconto_proporcional: "desconto_proporcional",
	descricao: "descricao",
	descricao_plano_valor_1: "descricao_plano_valor_1",
	descricao_plano_valor_2: "descricao_plano_valor_2",
	fixar_ip: "fixar_ip",
	id: "id",
	id_contrato: "id_contrato",
	id_contrato_produto_plano: "id_contrato_produto_plano",
	id_plano: "id_plano",
	id_produto: "id_produto",
	id_tipo_documento: "id_tipo_documento",
	id_unidade: "id_unidade",
	id_vd_contrato: "id_vd_contrato",
	inserido_em: "inserido_em",
	inserido_por: "inserido_por",
	limite_pacote: "limite_pacote",
	logins_simultaneos: "logins_simultaneos",
	obs: "obs",
	qtde: "qtde",
	qtde_repeticoes_desconto_produto: "qtde_repeticoes_desconto_produto",
	repetir: "repetir",
	repetir_qtde: "repetir_qtde",
	tipo: "tipo",
	tipo_desconto: "tipo_desconto",
	tv_pacotes_canais: "tv_pacotes_canais",
	ultima_atualizacao: "ultima_atualizacao",
	valor_adicional_pacote: "valor_adicional_pacote",
	valor_ate_vencimento: "valor_ate_vencimento",
	valor_desconto_produto: "valor_desconto_produto",
	valor_unit: "valor_unit",
} as const;

export const FIELD_LABELS = VD_CONTRATOS_PRODUTOS_FIELD_LABELS;

export const VD_CONTRATOS_PRODUTOS_DESCONTO_PROPORCIONAL_LABELS = {
	S: "S",
	N: "N",
} as const;

export const VD_CONTRATOS_PRODUTOS_REPETIR_LABELS = {
	V: "V",
	S: "S",
} as const;

export const VD_CONTRATOS_PRODUTOS_TIPO_LABELS = {
	I: "I",
	T: "T",
	S: "S",
	SVA: "SVA",
	TV: "TV",
	SMP: "SMP",
} as const;

export const VD_CONTRATOS_PRODUTOS_TIPO_DESCONTO_LABELS = {
	V: "V",
	P: "P",
} as const;

export const ENUM_LABELS_BY_FIELD = {
	desconto_proporcional: VD_CONTRATOS_PRODUTOS_DESCONTO_PROPORCIONAL_LABELS,
	repetir: VD_CONTRATOS_PRODUTOS_REPETIR_LABELS,
	tipo: VD_CONTRATOS_PRODUTOS_TIPO_LABELS,
	tipo_desconto: VD_CONTRATOS_PRODUTOS_TIPO_DESCONTO_LABELS,
} as const;

// ============================================================
// ENUM SCHEMAS (validação em runtime)
// ============================================================
export const vd_contratos_produtosDescontoProporcionalSchema = z.enum(
	["S", "N"],
	{
		error: () => ({
			message: "desconto_proporcional: valores válidos são [S, N]",
		}),
	},
);

export const vd_contratos_produtosRepetirSchema = z.enum(["V", "S"], {
	error: () => ({ message: "repetir: valores válidos são [V, S]" }),
});

export const vd_contratos_produtosTipoSchema = z.enum(
	["I", "T", "S", "SVA", "TV", "SMP"],
	{
		error: () => ({
			message: "tipo: valores válidos são [I, T, S, SVA, TV, SMP]",
		}),
	},
);

export const vd_contratos_produtosTipoDescontoSchema = z.enum(["V", "P"], {
	error: () => ({ message: "tipo_desconto: valores válidos são [V, P]" }),
});

// ============================================================
// ENUM TYPES (inferidos dos schemas)
// ============================================================
export type VdContratosProdutosDescontoProporcional = z.infer<
	typeof vd_contratos_produtosDescontoProporcionalSchema
>;

export type VdContratosProdutosRepetir = z.infer<
	typeof vd_contratos_produtosRepetirSchema
>;

export type VdContratosProdutosTipo = z.infer<
	typeof vd_contratos_produtosTipoSchema
>;

export type VdContratosProdutosTipoDesconto = z.infer<
	typeof vd_contratos_produtosTipoDescontoSchema
>;
