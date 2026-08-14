/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: pnpm generate-types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */

import { z } from "zod";

// ============================================================
// LABELS (single source of truth)
// ============================================================
export const TARIFAS_FIELD_LABELS = {
	createdAt: "Criado em",
	createdBy: "Criado por",
	createdById: "createdById",
	f_fk_tarifas: "f_fk_tarifas",
	f_tipo: "Tipo de Chamada",
	f_valor: "Valor",
	id: "ID",
	updatedAt: "Última atualização em",
	updatedBy: "Última atualização por",
	updatedById: "updatedById",
} as const;

export const FIELD_LABELS = TARIFAS_FIELD_LABELS;

export const TARIFAS_TIPO_LABELS = {
	MOVEL_SAINTE: "MOVEL_SAINTE",
	FIXO_SAINTE: "FIXO_SAINTE",
	MOVEL_ENTRANTE: "MOVEL_ENTRANTE",
	FIXO_ENTRANTE: "FIXO_ENTRANTE",
} as const;

export const ENUM_LABELS_BY_FIELD = {
	f_tipo: TARIFAS_TIPO_LABELS,
} as const;

// ============================================================
// ENUM SCHEMAS (validação em runtime)
// ============================================================
export const tarifasTipoSchema = z.enum(
	["MOVEL_SAINTE", "FIXO_SAINTE", "MOVEL_ENTRANTE", "FIXO_ENTRANTE"],
	{
		error: () => ({
			message:
				"tipo: valores válidos são [MOVEL_SAINTE, FIXO_SAINTE, MOVEL_ENTRANTE, FIXO_ENTRANTE]",
		}),
	},
);

// ============================================================
// ENUM TYPES (inferidos dos schemas)
// ============================================================
export type TarifasTipo = z.infer<typeof tarifasTipoSchema>;
