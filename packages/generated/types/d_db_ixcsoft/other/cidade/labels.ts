/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: bun run generate:types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */

import { z } from "zod";

// ============================================================
// LABELS (single source of truth)
// ============================================================
export const CIDADE_FIELD_LABELS = {
	api_id: "api_id",
	cod_cidade_nfse_forquilhinha_sc: "cod_cidade_nfse_forquilhinha_sc",
	cod_ibge: "cod_ibge",
	cod_siafi: "cod_siafi",
	codigo: "codigo",
	distrito_cod: "distrito_cod",
	distrito_desc: "distrito_desc",
	id: "id",
	latitude: "latitude",
	longitude: "longitude",
	nome: "nome",
	origem: "origem",
	regiao: "regiao",
	uf: "uf",
} as const;

export const FIELD_LABELS = CIDADE_FIELD_LABELS;

export const CIDADE_ORIGEM_LABELS = {
	N: "N",
	I: "I",
} as const;

export const ENUM_LABELS_BY_FIELD = {
	origem: CIDADE_ORIGEM_LABELS,
} as const;

// ============================================================
// ENUM SCHEMAS (validação em runtime)
// ============================================================
export const cidadeOrigemSchema = z.enum(["N", "I"], {
	error: () => ({ message: "origem: valores válidos são [N, I]" }),
});

// ============================================================
// ENUM TYPES (inferidos dos schemas)
// ============================================================
export type CidadeOrigem = z.infer<typeof cidadeOrigemSchema>;
