/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: pnpm generate-types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */

import { z } from "zod";
import {
	fn_areceberAguardandoConfirmacaoPagamentoSchema,
	fn_areceberArquivoRemessaBaixadoSchema,
	fn_areceberBaixaAutomaticaSchema,
	fn_areceberEmCobrancaSchema,
	fn_areceberEmProcessamentoSchema,
	fn_areceberEnviadoRemessaBaixaSchema,
	fn_areceberEstornadoSchema,
	fn_areceberFormaRecebimentoSchema,
	fn_areceberImpressoSchema,
	fn_areceberLiberadoSchema,
	fn_areceberLiberaPeriodoSchema,
	fn_areceberParceladoCartaoSchema,
	fn_areceberParcelaProporcionalSchema,
	fn_areceberPixStatusRecorrenteSchema,
	fn_areceberPixStatusSchema,
	fn_areceberPrevisaoSchema,
	fn_areceberRecebidoPorRecorrenciaSchema,
	fn_areceberRecebidoViaPixSchema,
	fn_areceberStatusSchema,
	fn_areceberTarifaGatewayLancadaSchema,
	fn_areceberTipoCobrancaPixSchema,
	fn_areceberTipoCobrancaSchema,
	fn_areceberTipoPagamentoCartaoSchema,
	fn_areceberTipoRecebimentoSchema,
	fn_areceberTipoRenegociacaoSchema,
	fn_areceberTituloImportadoSchema,
	fn_areceberTituloNegativacaoIntegracaoSchema,
	fn_areceberTituloProtestadoSchema,
	fn_areceberTituloRenegociadoSchema,
} from "./labels";

export const TABLE_NAME = "fn_areceber";
export const TABLE_LABEL = "fn_areceber";

// ============================================================
// BASE SCHEMA (campos escalares)
// ============================================================
export const fn_areceberBaseSchema = z.object({
	id: z.number(),
	agencia_sequencial: z.number(),
	aguardando_confirmacao_pagamento:
		fn_areceberAguardandoConfirmacaoPagamentoSchema,
	arquivo_remessa_baixado: fn_areceberArquivoRemessaBaixadoSchema,
	baixa_automatica: fn_areceberBaixaAutomaticaSchema,
	baixa_data: z.string(),
	baixa_id_operador: z.number(),
	bandeira_pagamento: z.string(),
	boleto: z.number(),
	caixa: z.number(),
	cancelamento_id_operador: z.number(),
	charge_id: z.string(),
	conta_recebimento: z.number(),
	credit_card_transaction_id: z.string(),
	credito_data: z.string(),
	data_cancelamento: z.string(),
	data_cotacao_diaria: z.string(),
	data_emissao: z.string(),
	data_fin_cdr_voip: z.string(),
	data_final: z.string(),
	data_final_ligacoes: z.string(),
	data_ini_cdr_voip: z.string(),
	data_inicial: z.string(),
	data_inicial_ligacoes: z.string(),
	data_prevista_tentativa_pix_recorrente: z.string(),
	data_vencimento: z.string(),
	desconto_condicional_valor: z.number(),
	descontos_adicionais: z.number(),
	documento: z.string(),
	duplicata: z.string(),
	em_cobranca: fn_areceberEmCobrancaSchema,
	em_processamento: fn_areceberEmProcessamentoSchema,
	enviado_remessa_baixa: fn_areceberEnviadoRemessaBaixaSchema,
	estornado: fn_areceberEstornadoSchema,
	filial_id: z.number(),
	forma_recebimento: fn_areceberFormaRecebimentoSchema,
	gateway_link: z.string(),
	gerencianet_token: z.string(),
	id_assinatura_cliente: z.number(),
	id_carteira_cobranca: z.number(),
	id_cliente: z.number(),
	id_cobranca: z.number(),
	id_conta: z.number(),
	id_contrato: z.number(),
	id_contrato_avulso: z.number(),
	id_contrato_principal: z.number(),
	id_im_imovel: z.number(),
	id_lote_geracao_financeiro: z.number(),
	id_lote_geracao_financeiro_fatura: z.number(),
	id_mot_cancelamento: z.number(),
	id_nota_gerada: z.number(),
	id_nota_gerada_opc2: z.number(),
	id_nota_gerada_opc3: z.number(),
	id_nota_gerada_opc4: z.number(),
	id_remessa: z.number(),
	id_remessa_alteracao: z.number(),
	id_remessa_baixa: z.number(),
	id_renegociacao: z.number(),
	id_renegociacao_novo: z.number(),
	id_saida: z.number(),
	id_sip: z.number(),
	ids_contratos_origem: z.string(),
	ids_faturas_origem: z.string(),
	impresso: fn_areceberImpressoSchema,
	libera_periodo: fn_areceberLiberaPeriodoSchema,
	liberado: fn_areceberLiberadoSchema,
	linha_digitavel: z.string(),
	lote: z.number(),
	moeda: z.string(),
	motivo_alteracao: z.string(),
	nn_boleto: z.string(),
	nparcela: z.number(),
	numero_parcela_recorrente: z.number(),
	obs: z.string(),
	origem_importacao: z.string(),
	pagamento_data: z.string(),
	pagamento_valor: z.number(),
	parcela_proporcional: fn_areceberParcelaProporcionalSchema,
	parcelado_cartao: fn_areceberParceladoCartaoSchema,
	pix_id_carteira_cobranca: z.number(),
	pix_status: fn_areceberPixStatusSchema,
	pix_status_recorrente: fn_areceberPixStatusRecorrenteSchema,
	pix_txid: z.string(),
	pix_txid_recorrente: z.string(),
	previsao: fn_areceberPrevisaoSchema,
	recebido_por_recorrencia: fn_areceberRecebidoPorRecorrenciaSchema,
	recebido_via_pix: fn_areceberRecebidoViaPixSchema,
	sequencialFacilito: z.number(),
	status: fn_areceberStatusSchema,
	status_cobranca: z.string(),
	status_remessa: z.string(),
	tarifa_gateway_lancada: fn_areceberTarifaGatewayLancadaSchema,
	tentativa_pix_recorrente: z.number(),
	tipo_cobranca: fn_areceberTipoCobrancaSchema,
	tipo_cobranca_pix: fn_areceberTipoCobrancaPixSchema,
	tipo_pagamento_cartao: fn_areceberTipoPagamentoCartaoSchema,
	tipo_recebimento: fn_areceberTipoRecebimentoSchema,
	tipo_renegociacao: fn_areceberTipoRenegociacaoSchema,
	titulo_importado: fn_areceberTituloImportadoSchema,
	titulo_negativacao_integracao: fn_areceberTituloNegativacaoIntegracaoSchema,
	titulo_protestado: fn_areceberTituloProtestadoSchema,
	titulo_renegociado: fn_areceberTituloRenegociadoSchema,
	ultima_atualizacao: z.string(),
	validade_desconto_condicional: z.string(),
	valor: z.number(),
	valor_aberto: z.number(),
	valor_ate_vencimento: z.number(),
	valor_cancelado: z.number(),
	valor_cotacao_diaria: z.number(),
	valor_desconto_ate_vencimento: z.number(),
	valor_juros: z.number(),
	valor_juros_multa: z.number(),
	valor_moeda_original: z.number(),
	valor_multas: z.number(),
	valor_recebido: z.number(),
	valor_total_com_juros: z.number(),
});

export const RELATION_TARGETS = {} as const;

// ============================================================
// SCHEMA PRINCIPAL (validação completa)
// ============================================================
export const fn_areceberSchema = fn_areceberBaseSchema;

// ============================================================
// CREATE SCHEMA
// ============================================================
export const fn_areceberCreateSchema = fn_areceberSchema.omit({
	id: true,
});

// ============================================================
// UPDATE SCHEMA
// ============================================================
export const fn_areceberUpdateSchema = fn_areceberCreateSchema.partial();
