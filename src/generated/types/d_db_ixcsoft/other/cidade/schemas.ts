/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: pnpm generate-types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */

import { z } from "zod";
import { cidadeOrigemSchema } from "./labels";

export const TABLE_NAME = "cidade";
export const TABLE_LABEL = "cidade";

// ============================================================
// BASE SCHEMA (campos escalares)
// ============================================================
export const cidadeBaseSchema = z.object({
	id: z.number(),
	api_id: z.number(),
	cod_cidade_nfse_forquilhinha_sc: z.number(),
	cod_ibge: z.number(),
	cod_siafi: z.string(),
	codigo: z.string(),
	distrito_cod: z.string(),
	distrito_desc: z.string(),
	latitude: z.string(),
	longitude: z.string(),
	nome: z.string(),
	origem: cidadeOrigemSchema,
	regiao: z.string(),
	uf: z.number(),
});

export const RELATION_TARGETS = {} as const;

// ============================================================
// SCHEMA PRINCIPAL (validação completa)
// ============================================================
export const cidadeSchema = cidadeBaseSchema;

// ============================================================
// CREATE SCHEMA
// ============================================================
export const cidadeCreateSchema = cidadeSchema.omit({
	id: true,
});

// ============================================================
// UPDATE SCHEMA
// ============================================================
export const cidadeUpdateSchema = cidadeCreateSchema.partial();
