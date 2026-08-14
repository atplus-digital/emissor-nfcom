/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: pnpm generate-types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */

import { z } from "zod";

// ============================================================
// LABELS (single source of truth)
// ============================================================
export const FN_ARECEBER_FIELD_LABELS = {
	agencia_sequencial: "agencia_sequencial",
	aguardando_confirmacao_pagamento: "aguardando_confirmacao_pagamento",
	arquivo_remessa_baixado: "arquivo_remessa_baixado",
	baixa_automatica: "baixa_automatica",
	baixa_data: "baixa_data",
	baixa_id_operador: "baixa_id_operador",
	bandeira_pagamento: "bandeira_pagamento",
	boleto: "boleto",
	caixa: "caixa",
	cancelamento_id_operador: "cancelamento_id_operador",
	charge_id: "charge_id",
	conta_recebimento: "conta_recebimento",
	credit_card_transaction_id: "credit_card_transaction_id",
	credito_data: "credito_data",
	data_cancelamento: "data_cancelamento",
	data_cotacao_diaria: "data_cotacao_diaria",
	data_emissao: "data_emissao",
	data_fin_cdr_voip: "data_fin_cdr_voip",
	data_final: "data_final",
	data_final_ligacoes: "data_final_ligacoes",
	data_ini_cdr_voip: "data_ini_cdr_voip",
	data_inicial: "data_inicial",
	data_inicial_ligacoes: "data_inicial_ligacoes",
	data_prevista_tentativa_pix_recorrente:
		"data_prevista_tentativa_pix_recorrente",
	data_vencimento: "data_vencimento",
	desconto_condicional_valor: "desconto_condicional_valor",
	descontos_adicionais: "descontos_adicionais",
	documento: "documento",
	duplicata: "duplicata",
	em_cobranca: "em_cobranca",
	em_processamento: "em_processamento",
	enviado_remessa_baixa: "enviado_remessa_baixa",
	estornado: "estornado",
	filial_id: "filial_id",
	forma_recebimento: "forma_recebimento",
	gateway_link: "gateway_link",
	gerencianet_token: "gerencianet_token",
	id: "id",
	id_assinatura_cliente: "id_assinatura_cliente",
	id_carteira_cobranca: "id_carteira_cobranca",
	id_cliente: "id_cliente",
	id_cobranca: "id_cobranca",
	id_conta: "id_conta",
	id_contrato: "id_contrato",
	id_contrato_avulso: "id_contrato_avulso",
	id_contrato_principal: "id_contrato_principal",
	id_im_imovel: "id_im_imovel",
	id_lote_geracao_financeiro: "id_lote_geracao_financeiro",
	id_lote_geracao_financeiro_fatura: "id_lote_geracao_financeiro_fatura",
	id_mot_cancelamento: "id_mot_cancelamento",
	id_nota_gerada: "id_nota_gerada",
	id_nota_gerada_opc2: "id_nota_gerada_opc2",
	id_nota_gerada_opc3: "id_nota_gerada_opc3",
	id_nota_gerada_opc4: "id_nota_gerada_opc4",
	id_remessa: "id_remessa",
	id_remessa_alteracao: "id_remessa_alteracao",
	id_remessa_baixa: "id_remessa_baixa",
	id_renegociacao: "id_renegociacao",
	id_renegociacao_novo: "id_renegociacao_novo",
	id_saida: "id_saida",
	id_sip: "id_sip",
	ids_contratos_origem: "ids_contratos_origem",
	ids_faturas_origem: "ids_faturas_origem",
	impresso: "impresso",
	libera_periodo: "libera_periodo",
	liberado: "liberado",
	linha_digitavel: "linha_digitavel",
	lote: "lote",
	moeda: "moeda",
	motivo_alteracao: "motivo_alteracao",
	nn_boleto: "nn_boleto",
	nparcela: "nparcela",
	numero_parcela_recorrente: "numero_parcela_recorrente",
	obs: "obs",
	origem_importacao: "origem_importacao",
	pagamento_data: "pagamento_data",
	pagamento_valor: "pagamento_valor",
	parcela_proporcional: "parcela_proporcional",
	parcelado_cartao: "parcelado_cartao",
	pix_id_carteira_cobranca: "pix_id_carteira_cobranca",
	pix_status: "pix_status",
	pix_status_recorrente: "pix_status_recorrente",
	pix_txid: "pix_txid",
	pix_txid_recorrente: "pix_txid_recorrente",
	previsao: "previsao",
	recebido_por_recorrencia: "recebido_por_recorrencia",
	recebido_via_pix: "recebido_via_pix",
	sequencialFacilito: "sequencialFacilito",
	status: "status",
	status_cobranca: "status_cobranca",
	status_remessa: "status_remessa",
	tarifa_gateway_lancada: "tarifa_gateway_lancada",
	tentativa_pix_recorrente: "tentativa_pix_recorrente",
	tipo_cobranca: "tipo_cobranca",
	tipo_cobranca_pix: "tipo_cobranca_pix",
	tipo_pagamento_cartao: "tipo_pagamento_cartao",
	tipo_recebimento: "tipo_recebimento",
	tipo_renegociacao: "tipo_renegociacao",
	titulo_importado: "titulo_importado",
	titulo_negativacao_integracao: "titulo_negativacao_integracao",
	titulo_protestado: "titulo_protestado",
	titulo_renegociado: "titulo_renegociado",
	ultima_atualizacao: "ultima_atualizacao",
	validade_desconto_condicional: "validade_desconto_condicional",
	valor: "valor",
	valor_aberto: "valor_aberto",
	valor_ate_vencimento: "valor_ate_vencimento",
	valor_cancelado: "valor_cancelado",
	valor_cotacao_diaria: "valor_cotacao_diaria",
	valor_desconto_ate_vencimento: "valor_desconto_ate_vencimento",
	valor_juros: "valor_juros",
	valor_juros_multa: "valor_juros_multa",
	valor_moeda_original: "valor_moeda_original",
	valor_multas: "valor_multas",
	valor_recebido: "valor_recebido",
	valor_total_com_juros: "valor_total_com_juros",
} as const;

export const FIELD_LABELS = FN_ARECEBER_FIELD_LABELS;

export const FN_ARECEBER_AGUARDANDO_CONFIRMACAO_PAGAMENTO_LABELS = {
	S: "S",
	N: "N",
} as const;

export const FN_ARECEBER_ARQUIVO_REMESSA_BAIXADO_LABELS = {
	S: "S",
	N: "N",
} as const;

export const FN_ARECEBER_BAIXA_AUTOMATICA_LABELS = {
	S: "S",
	N: "N",
} as const;

export const FN_ARECEBER_EM_COBRANCA_LABELS = {
	S: "S",
	N: "N",
} as const;

export const FN_ARECEBER_EM_PROCESSAMENTO_LABELS = {
	N: "N",
	S: "S",
} as const;

export const FN_ARECEBER_ENVIADO_REMESSA_BAIXA_LABELS = {
	S: "S",
	N: "N",
} as const;

export const FN_ARECEBER_ESTORNADO_LABELS = {
	S: "S",
	N: "N",
} as const;

export const FN_ARECEBER_FORMA_RECEBIMENTO_LABELS = {
	M: "M",
	R: "R",
} as const;

export const FN_ARECEBER_IMPRESSO_LABELS = {
	S: "S",
	N: "N",
} as const;

export const FN_ARECEBER_LIBERA_PERIODO_LABELS = {
	N: "N",
	S: "S",
} as const;

export const FN_ARECEBER_LIBERADO_LABELS = {
	N: "N",
	S: "S",
} as const;

export const FN_ARECEBER_PARCELA_PROPORCIONAL_LABELS = {
	S: "S",
	N: "N",
} as const;

export const FN_ARECEBER_PARCELADO_CARTAO_LABELS = {
	N: "N",
	S: "S",
} as const;

export const FN_ARECEBER_PIX_STATUS_LABELS = {
	A: "A",
	C: "C",
} as const;

export const FN_ARECEBER_PIX_STATUS_RECORRENTE_LABELS = {
	CRIADA: "CRIADA",
	ATIVA: "ATIVA",
	CONCLUIDA: "CONCLUIDA",
	EXPIRADA: "EXPIRADA",
	REJEITADA: "REJEITADA",
	CANCELADA: "CANCELADA",
} as const;

export const FN_ARECEBER_PREVISAO_LABELS = {
	N: "N",
	S: "S",
	M: "M",
} as const;

export const FN_ARECEBER_RECEBIDO_POR_RECORRENCIA_LABELS = {
	S: "S",
	N: "N",
} as const;

export const FN_ARECEBER_RECEBIDO_VIA_PIX_LABELS = {
	S: "S",
	N: "N",
} as const;

export const FN_ARECEBER_STATUS_LABELS = {
	A: "A receber",
	R: "Recebido",
	P: "Parcial",
	C: "Cancelado",
} as const;

export const FN_ARECEBER_TARIFA_GATEWAY_LANCADA_LABELS = {
	S: "S",
	N: "N",
} as const;

export const FN_ARECEBER_TIPO_COBRANCA_LABELS = {
	I: "I",
	E: "E",
} as const;

export const FN_ARECEBER_TIPO_COBRANCA_PIX_LABELS = {
	COM_VENCIMENTO: "COM_VENCIMENTO",
	IMEDIATA: "IMEDIATA",
} as const;

export const FN_ARECEBER_TIPO_PAGAMENTO_CARTAO_LABELS = {
	N: "N",
	R: "R",
} as const;

export const FN_ARECEBER_TIPO_RECEBIMENTO_LABELS = {
	Boleto: "Boleto",
	Cheque: "Cheque",
	Cartão: "Cartão",
	Dinheiro: "Dinheiro",
	Depósito: "Depósito",
	Gateway: "Gateway",
	Débito: "Débito",
	Fatura: "Fatura",
	ArrecadacaoRecebimento: "ArrecadacaoRecebimento",
	Transferencia: "Transferencia",
	Pix: "Pix",
} as const;

export const FN_ARECEBER_TIPO_RENEGOCIACAO_LABELS = {
	R: "R",
	N: "N",
} as const;

export const FN_ARECEBER_TITULO_IMPORTADO_LABELS = {
	S: "S",
	N: "N",
} as const;

export const FN_ARECEBER_TITULO_NEGATIVACAO_INTEGRACAO_LABELS = {
	S: "S",
	N: "N",
} as const;

export const FN_ARECEBER_TITULO_PROTESTADO_LABELS = {
	S: "S",
	N: "N",
} as const;

export const FN_ARECEBER_TITULO_RENEGOCIADO_LABELS = {
	S: "S",
	N: "N",
} as const;

export const ENUM_LABELS_BY_FIELD = {
	aguardando_confirmacao_pagamento:
		FN_ARECEBER_AGUARDANDO_CONFIRMACAO_PAGAMENTO_LABELS,
	arquivo_remessa_baixado: FN_ARECEBER_ARQUIVO_REMESSA_BAIXADO_LABELS,
	baixa_automatica: FN_ARECEBER_BAIXA_AUTOMATICA_LABELS,
	em_cobranca: FN_ARECEBER_EM_COBRANCA_LABELS,
	em_processamento: FN_ARECEBER_EM_PROCESSAMENTO_LABELS,
	enviado_remessa_baixa: FN_ARECEBER_ENVIADO_REMESSA_BAIXA_LABELS,
	estornado: FN_ARECEBER_ESTORNADO_LABELS,
	forma_recebimento: FN_ARECEBER_FORMA_RECEBIMENTO_LABELS,
	impresso: FN_ARECEBER_IMPRESSO_LABELS,
	libera_periodo: FN_ARECEBER_LIBERA_PERIODO_LABELS,
	liberado: FN_ARECEBER_LIBERADO_LABELS,
	parcela_proporcional: FN_ARECEBER_PARCELA_PROPORCIONAL_LABELS,
	parcelado_cartao: FN_ARECEBER_PARCELADO_CARTAO_LABELS,
	pix_status: FN_ARECEBER_PIX_STATUS_LABELS,
	pix_status_recorrente: FN_ARECEBER_PIX_STATUS_RECORRENTE_LABELS,
	previsao: FN_ARECEBER_PREVISAO_LABELS,
	recebido_por_recorrencia: FN_ARECEBER_RECEBIDO_POR_RECORRENCIA_LABELS,
	recebido_via_pix: FN_ARECEBER_RECEBIDO_VIA_PIX_LABELS,
	status: FN_ARECEBER_STATUS_LABELS,
	tarifa_gateway_lancada: FN_ARECEBER_TARIFA_GATEWAY_LANCADA_LABELS,
	tipo_cobranca: FN_ARECEBER_TIPO_COBRANCA_LABELS,
	tipo_cobranca_pix: FN_ARECEBER_TIPO_COBRANCA_PIX_LABELS,
	tipo_pagamento_cartao: FN_ARECEBER_TIPO_PAGAMENTO_CARTAO_LABELS,
	tipo_recebimento: FN_ARECEBER_TIPO_RECEBIMENTO_LABELS,
	tipo_renegociacao: FN_ARECEBER_TIPO_RENEGOCIACAO_LABELS,
	titulo_importado: FN_ARECEBER_TITULO_IMPORTADO_LABELS,
	titulo_negativacao_integracao:
		FN_ARECEBER_TITULO_NEGATIVACAO_INTEGRACAO_LABELS,
	titulo_protestado: FN_ARECEBER_TITULO_PROTESTADO_LABELS,
	titulo_renegociado: FN_ARECEBER_TITULO_RENEGOCIADO_LABELS,
} as const;

// ============================================================
// ENUM SCHEMAS (validação em runtime)
// ============================================================
export const fn_areceberAguardandoConfirmacaoPagamentoSchema = z.enum(
	["S", "N"],
	{
		error: () => ({
			message: "aguardando_confirmacao_pagamento: valores válidos são [S, N]",
		}),
	},
);

export const fn_areceberArquivoRemessaBaixadoSchema = z.enum(["S", "N"], {
	error: () => ({
		message: "arquivo_remessa_baixado: valores válidos são [S, N]",
	}),
});

export const fn_areceberBaixaAutomaticaSchema = z.enum(["S", "N"], {
	error: () => ({ message: "baixa_automatica: valores válidos são [S, N]" }),
});

export const fn_areceberEmCobrancaSchema = z.enum(["S", "N"], {
	error: () => ({ message: "em_cobranca: valores válidos são [S, N]" }),
});

export const fn_areceberEmProcessamentoSchema = z.enum(["N", "S"], {
	error: () => ({ message: "em_processamento: valores válidos são [N, S]" }),
});

export const fn_areceberEnviadoRemessaBaixaSchema = z.enum(["S", "N"], {
	error: () => ({
		message: "enviado_remessa_baixa: valores válidos são [S, N]",
	}),
});

export const fn_areceberEstornadoSchema = z.enum(["S", "N"], {
	error: () => ({ message: "estornado: valores válidos são [S, N]" }),
});

export const fn_areceberFormaRecebimentoSchema = z.enum(["M", "R"], {
	error: () => ({ message: "forma_recebimento: valores válidos são [M, R]" }),
});

export const fn_areceberImpressoSchema = z.enum(["S", "N"], {
	error: () => ({ message: "impresso: valores válidos são [S, N]" }),
});

export const fn_areceberLiberaPeriodoSchema = z.enum(["N", "S"], {
	error: () => ({ message: "libera_periodo: valores válidos são [N, S]" }),
});

export const fn_areceberLiberadoSchema = z.enum(["N", "S"], {
	error: () => ({ message: "liberado: valores válidos são [N, S]" }),
});

export const fn_areceberParcelaProporcionalSchema = z.enum(["S", "N"], {
	error: () => ({
		message: "parcela_proporcional: valores válidos são [S, N]",
	}),
});

export const fn_areceberParceladoCartaoSchema = z.enum(["N", "S"], {
	error: () => ({ message: "parcelado_cartao: valores válidos são [N, S]" }),
});

export const fn_areceberPixStatusSchema = z.enum(["A", "C"], {
	error: () => ({ message: "pix_status: valores válidos são [A, C]" }),
});

export const fn_areceberPixStatusRecorrenteSchema = z.enum(
	["CRIADA", "ATIVA", "CONCLUIDA", "EXPIRADA", "REJEITADA", "CANCELADA"],
	{
		error: () => ({
			message:
				"pix_status_recorrente: valores válidos são [CRIADA, ATIVA, CONCLUIDA, EXPIRADA, REJEITADA, CANCELADA]",
		}),
	},
);

export const fn_areceberPrevisaoSchema = z.enum(["N", "S", "M"], {
	error: () => ({ message: "previsao: valores válidos são [N, S, M]" }),
});

export const fn_areceberRecebidoPorRecorrenciaSchema = z.enum(["S", "N"], {
	error: () => ({
		message: "recebido_por_recorrencia: valores válidos são [S, N]",
	}),
});

export const fn_areceberRecebidoViaPixSchema = z.enum(["S", "N"], {
	error: () => ({ message: "recebido_via_pix: valores válidos são [S, N]" }),
});

export const fn_areceberStatusSchema = z.enum(["A", "R", "P", "C"], {
	error: () => ({
		message:
			"status: valores válidos são [A receber, Recebido, Parcial, Cancelado]",
	}),
});

export const fn_areceberTarifaGatewayLancadaSchema = z.enum(["S", "N"], {
	error: () => ({
		message: "tarifa_gateway_lancada: valores válidos são [S, N]",
	}),
});

export const fn_areceberTipoCobrancaSchema = z.enum(["I", "E"], {
	error: () => ({ message: "tipo_cobranca: valores válidos são [I, E]" }),
});

export const fn_areceberTipoCobrancaPixSchema = z.enum(
	["COM_VENCIMENTO", "IMEDIATA"],
	{
		error: () => ({
			message:
				"tipo_cobranca_pix: valores válidos são [COM_VENCIMENTO, IMEDIATA]",
		}),
	},
);

export const fn_areceberTipoPagamentoCartaoSchema = z.enum(["N", "R"], {
	error: () => ({
		message: "tipo_pagamento_cartao: valores válidos são [N, R]",
	}),
});

export const fn_areceberTipoRecebimentoSchema = z.enum(
	[
		"Boleto",
		"Cheque",
		"Cartão",
		"Dinheiro",
		"Depósito",
		"Gateway",
		"Débito",
		"Fatura",
		"ArrecadacaoRecebimento",
		"Transferencia",
		"Pix",
	],
	{
		error: () => ({
			message:
				"tipo_recebimento: valores válidos são [Boleto, Cheque, Cartão, Dinheiro, Depósito, Gateway, Débito, Fatura, ArrecadacaoRecebimento, Transferencia, Pix]",
		}),
	},
);

export const fn_areceberTipoRenegociacaoSchema = z.enum(["R", "N"], {
	error: () => ({ message: "tipo_renegociacao: valores válidos são [R, N]" }),
});

export const fn_areceberTituloImportadoSchema = z.enum(["S", "N"], {
	error: () => ({ message: "titulo_importado: valores válidos são [S, N]" }),
});

export const fn_areceberTituloNegativacaoIntegracaoSchema = z.enum(["S", "N"], {
	error: () => ({
		message: "titulo_negativacao_integracao: valores válidos são [S, N]",
	}),
});

export const fn_areceberTituloProtestadoSchema = z.enum(["S", "N"], {
	error: () => ({ message: "titulo_protestado: valores válidos são [S, N]" }),
});

export const fn_areceberTituloRenegociadoSchema = z.enum(["S", "N"], {
	error: () => ({ message: "titulo_renegociado: valores válidos são [S, N]" }),
});

// ============================================================
// ENUM TYPES (inferidos dos schemas)
// ============================================================
export type FnAreceberAguardandoConfirmacaoPagamento = z.infer<
	typeof fn_areceberAguardandoConfirmacaoPagamentoSchema
>;

export type FnAreceberArquivoRemessaBaixado = z.infer<
	typeof fn_areceberArquivoRemessaBaixadoSchema
>;

export type FnAreceberBaixaAutomatica = z.infer<
	typeof fn_areceberBaixaAutomaticaSchema
>;

export type FnAreceberEmCobranca = z.infer<typeof fn_areceberEmCobrancaSchema>;

export type FnAreceberEmProcessamento = z.infer<
	typeof fn_areceberEmProcessamentoSchema
>;

export type FnAreceberEnviadoRemessaBaixa = z.infer<
	typeof fn_areceberEnviadoRemessaBaixaSchema
>;

export type FnAreceberEstornado = z.infer<typeof fn_areceberEstornadoSchema>;

export type FnAreceberFormaRecebimento = z.infer<
	typeof fn_areceberFormaRecebimentoSchema
>;

export type FnAreceberImpresso = z.infer<typeof fn_areceberImpressoSchema>;

export type FnAreceberLiberaPeriodo = z.infer<
	typeof fn_areceberLiberaPeriodoSchema
>;

export type FnAreceberLiberado = z.infer<typeof fn_areceberLiberadoSchema>;

export type FnAreceberParcelaProporcional = z.infer<
	typeof fn_areceberParcelaProporcionalSchema
>;

export type FnAreceberParceladoCartao = z.infer<
	typeof fn_areceberParceladoCartaoSchema
>;

export type FnAreceberPixStatus = z.infer<typeof fn_areceberPixStatusSchema>;

export type FnAreceberPixStatusRecorrente = z.infer<
	typeof fn_areceberPixStatusRecorrenteSchema
>;

export type FnAreceberPrevisao = z.infer<typeof fn_areceberPrevisaoSchema>;

export type FnAreceberRecebidoPorRecorrencia = z.infer<
	typeof fn_areceberRecebidoPorRecorrenciaSchema
>;

export type FnAreceberRecebidoViaPix = z.infer<
	typeof fn_areceberRecebidoViaPixSchema
>;

export type FnAreceberStatus = z.infer<typeof fn_areceberStatusSchema>;

export type FnAreceberTarifaGatewayLancada = z.infer<
	typeof fn_areceberTarifaGatewayLancadaSchema
>;

export type FnAreceberTipoCobranca = z.infer<
	typeof fn_areceberTipoCobrancaSchema
>;

export type FnAreceberTipoCobrancaPix = z.infer<
	typeof fn_areceberTipoCobrancaPixSchema
>;

export type FnAreceberTipoPagamentoCartao = z.infer<
	typeof fn_areceberTipoPagamentoCartaoSchema
>;

export type FnAreceberTipoRecebimento = z.infer<
	typeof fn_areceberTipoRecebimentoSchema
>;

export type FnAreceberTipoRenegociacao = z.infer<
	typeof fn_areceberTipoRenegociacaoSchema
>;

export type FnAreceberTituloImportado = z.infer<
	typeof fn_areceberTituloImportadoSchema
>;

export type FnAreceberTituloNegativacaoIntegracao = z.infer<
	typeof fn_areceberTituloNegativacaoIntegracaoSchema
>;

export type FnAreceberTituloProtestado = z.infer<
	typeof fn_areceberTituloProtestadoSchema
>;

export type FnAreceberTituloRenegociado = z.infer<
	typeof fn_areceberTituloRenegociadoSchema
>;
