/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: bun run generate:types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */

import { z } from "zod";
import {
	cliente_contrato_tipoAtivoSchema,
	cliente_contrato_tipoBasePeriodoPrestacaoSchema,
	cliente_contrato_tipoDisponivelViabilidadeSchema,
	cliente_contrato_tipoPagamentoAntecipadoSchema,
	cliente_contrato_tipoPeriodoSchema,
	cliente_contrato_tipoTipoPagamentoSchema,
} from "./labels";

export const TABLE_NAME = "cliente_contrato_tipo";
export const TABLE_LABEL = "cliente_contrato_tipo";

// ============================================================
// BASE SCHEMA (campos escalares)
// ============================================================
export const cliente_contrato_tipoBaseSchema = z.object({
	id: z.number(),
	ativo: cliente_contrato_tipoAtivoSchema,
	avisar_dias: z.number(),
	base_periodo_prestacao: cliente_contrato_tipoBasePeriodoPrestacaoSchema,
	bloquear_dias: z.number(),
	bloqueio_renegociado_n_dias: z.number(),
	dias_carencia_pre: z.number(),
	dias_proporcional_cob_mes: z.number(),
	disponivel_viabilidade: cliente_contrato_tipoDisponivelViabilidadeSchema,
	id_condicoes_pagamento: z.number(),
	max_titulos_abertos_gerar_contrato: z.number(),
	ordem: z.number(),
	pagamento_antecipado: cliente_contrato_tipoPagamentoAntecipadoSchema,
	parcela_cobrar_proporcional: z.number(),
	parcelas_cob_adicional: z.string(),
	periodo: cliente_contrato_tipoPeriodoSchema,
	qtd_periodos: z.number(),
	tipo_contrato: z.string(),
	tipo_pagamento: cliente_contrato_tipoTipoPagamentoSchema,
	ultima_atualizacao: z.string(),
});

export const RELATION_TARGETS = {} as const;

// ============================================================
// SCHEMA PRINCIPAL (validação completa)
// ============================================================
export const cliente_contrato_tipoSchema = cliente_contrato_tipoBaseSchema;

// ============================================================
// CREATE SCHEMA
// ============================================================
export const cliente_contrato_tipoCreateSchema =
	cliente_contrato_tipoSchema.omit({
		id: true,
	});

// ============================================================
// UPDATE SCHEMA
// ============================================================
export const cliente_contrato_tipoUpdateSchema =
	cliente_contrato_tipoCreateSchema.partial();
