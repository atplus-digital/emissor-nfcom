/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: bun run generate:types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */

import { z } from "zod";

// ============================================================
// LABELS (single source of truth)
// ============================================================
export const PLANOS_DE_SERVICO_FIELD_LABELS = {
	createdAt: "Criado em",
	createdBy: "Criado por",
	createdById: "createdById",
	f_assinatura_mensal: "Assinatura Mensal",
	f_c8flsp9105w: "Parceiros",
	f_eiyuv62nhru: "Parceiros",
	f_fk_planos_de_servico: "f_fk_planos_de_servico",
	f_hl6rivwu39j: "f_hl6rivwu39j",
	f_luxc5wno255: "f_luxc5wno255",
	f_nome: "Nome",
	f_o0i69g0wqdk: "f_o0i69g0wqdk",
	f_plano: "Plano",
	f_plano_tarifa: "Plano de Tarifa",
	f_quantidade_canais: "Quantidade de Canais",
	f_quantidade_dids: "Quantidade de DID's",
	f_tarifas: "Tarifas",
	id: "ID",
	updatedAt: "Última atualização em",
	updatedBy: "Última atualização por",
	updatedById: "updatedById",
} as const;

export const FIELD_LABELS = PLANOS_DE_SERVICO_FIELD_LABELS;

export const PLANOS_DE_SERVICO_PLANO_TARIFA_LABELS = {
	2: "POS-FRASA",
	3: "POS-GD",
	4: "POS-ZICTEC",
	5: "POS-PARCEIRO-ILIMITADO",
} as const;

export const ENUM_LABELS_BY_FIELD = {
	f_plano_tarifa: PLANOS_DE_SERVICO_PLANO_TARIFA_LABELS,
} as const;

// ============================================================
// ENUM SCHEMAS (validação em runtime)
// ============================================================
export const planos_de_servicoPlanoTarifaSchema = z.enum(["2", "3", "4", "5"], {
	error: () => ({
		message:
			"plano_tarifa: valores válidos são [POS-FRASA, POS-GD, POS-ZICTEC, POS-PARCEIRO-ILIMITADO]",
	}),
});

// ============================================================
// ENUM TYPES (inferidos dos schemas)
// ============================================================
export type PlanosDeServicoPlanoTarifa = z.infer<
	typeof planos_de_servicoPlanoTarifaSchema
>;
