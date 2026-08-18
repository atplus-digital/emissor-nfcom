/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: bun run generate:types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */
import type { z } from "zod";

// Re-exports: Labels + Enums
export * from "./labels";

// Re-exports: Schemas
export * from "./schemas";

// Type inferences
export type SolicitacoesNumeracao = z.infer<
	typeof import("./schemas").solicitacoes_numeracaoSchema
>;
export type SolicitacoesNumeracaoRelations = z.infer<
	typeof import("./schemas").solicitacoes_numeracaoRelationSchema
>;

export type SolicitacoesNumeracaoRelationKey =
	keyof SolicitacoesNumeracaoRelations;
