/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: pnpm generate-types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */

import { z } from "zod";

// ============================================================
// LABELS (single source of truth)
// ============================================================
export const CLIENTE_CONTRATO_TIPO_FIELD_LABELS = {
	ativo: "ativo",
	avisar_dias: "avisar_dias",
	base_periodo_prestacao: "base_periodo_prestacao",
	bloquear_dias: "bloquear_dias",
	bloqueio_renegociado_n_dias: "bloqueio_renegociado_n_dias",
	dias_carencia_pre: "dias_carencia_pre",
	dias_proporcional_cob_mes: "dias_proporcional_cob_mes",
	disponivel_viabilidade: "disponivel_viabilidade",
	id: "id",
	id_condicoes_pagamento: "id_condicoes_pagamento",
	max_titulos_abertos_gerar_contrato: "max_titulos_abertos_gerar_contrato",
	ordem: "ordem",
	pagamento_antecipado: "pagamento_antecipado",
	parcela_cobrar_proporcional: "parcela_cobrar_proporcional",
	parcelas_cob_adicional: "parcelas_cob_adicional",
	periodo: "periodo",
	qtd_periodos: "qtd_periodos",
	tipo_contrato: "tipo_contrato",
	tipo_pagamento: "tipo_pagamento",
	ultima_atualizacao: "ultima_atualizacao",
} as const;

export const FIELD_LABELS = CLIENTE_CONTRATO_TIPO_FIELD_LABELS;

export const CLIENTE_CONTRATO_TIPO_ATIVO_LABELS = {
	S: "S",
	N: "N",
} as const;

export const CLIENTE_CONTRATO_TIPO_BASE_PERIODO_PRESTACAO_LABELS = {
	V: "V",
	C: "C",
	P: "P",
} as const;

export const CLIENTE_CONTRATO_TIPO_DISPONIVEL_VIABILIDADE_LABELS = {
	S: "S",
	N: "N",
} as const;

export const CLIENTE_CONTRATO_TIPO_PAGAMENTO_ANTECIPADO_LABELS = {
	S: "S",
	N: "N",
} as const;

export const CLIENTE_CONTRATO_TIPO_PERIODO_LABELS = {
	D: "D",
	M: "M",
	A: "A",
} as const;

export const CLIENTE_CONTRATO_TIPO_TIPO_PAGAMENTO_LABELS = {
	Pre: "Pre",
	Pos: "Pos",
} as const;

export const ENUM_LABELS_BY_FIELD = {
	ativo: CLIENTE_CONTRATO_TIPO_ATIVO_LABELS,
	base_periodo_prestacao: CLIENTE_CONTRATO_TIPO_BASE_PERIODO_PRESTACAO_LABELS,
	disponivel_viabilidade: CLIENTE_CONTRATO_TIPO_DISPONIVEL_VIABILIDADE_LABELS,
	pagamento_antecipado: CLIENTE_CONTRATO_TIPO_PAGAMENTO_ANTECIPADO_LABELS,
	periodo: CLIENTE_CONTRATO_TIPO_PERIODO_LABELS,
	tipo_pagamento: CLIENTE_CONTRATO_TIPO_TIPO_PAGAMENTO_LABELS,
} as const;

// ============================================================
// ENUM SCHEMAS (validação em runtime)
// ============================================================
export const cliente_contrato_tipoAtivoSchema = z.enum(["S", "N"], {
	error: () => ({ message: "ativo: valores válidos são [S, N]" }),
});

export const cliente_contrato_tipoBasePeriodoPrestacaoSchema = z.enum(
	["V", "C", "P"],
	{
		error: () => ({
			message: "base_periodo_prestacao: valores válidos são [V, C, P]",
		}),
	},
);

export const cliente_contrato_tipoDisponivelViabilidadeSchema = z.enum(
	["S", "N"],
	{
		error: () => ({
			message: "disponivel_viabilidade: valores válidos são [S, N]",
		}),
	},
);

export const cliente_contrato_tipoPagamentoAntecipadoSchema = z.enum(
	["S", "N"],
	{
		error: () => ({
			message: "pagamento_antecipado: valores válidos são [S, N]",
		}),
	},
);

export const cliente_contrato_tipoPeriodoSchema = z.enum(["D", "M", "A"], {
	error: () => ({ message: "periodo: valores válidos são [D, M, A]" }),
});

export const cliente_contrato_tipoTipoPagamentoSchema = z.enum(["Pre", "Pos"], {
	error: () => ({ message: "tipo_pagamento: valores válidos são [Pre, Pos]" }),
});

// ============================================================
// ENUM TYPES (inferidos dos schemas)
// ============================================================
export type ClienteContratoTipoAtivo = z.infer<
	typeof cliente_contrato_tipoAtivoSchema
>;

export type ClienteContratoTipoBasePeriodoPrestacao = z.infer<
	typeof cliente_contrato_tipoBasePeriodoPrestacaoSchema
>;

export type ClienteContratoTipoDisponivelViabilidade = z.infer<
	typeof cliente_contrato_tipoDisponivelViabilidadeSchema
>;

export type ClienteContratoTipoPagamentoAntecipado = z.infer<
	typeof cliente_contrato_tipoPagamentoAntecipadoSchema
>;

export type ClienteContratoTipoPeriodo = z.infer<
	typeof cliente_contrato_tipoPeriodoSchema
>;

export type ClienteContratoTipoTipoPagamento = z.infer<
	typeof cliente_contrato_tipoTipoPagamentoSchema
>;
