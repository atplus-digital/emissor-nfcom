/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: pnpm generate-types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */
import type { z } from "zod";

// Re-exports: Labels + Enums
export * from "./labels";

// Re-exports: Schemas
export * from "./schemas";

// Type inferences
export type ServicosAdicionais = z.infer<
	typeof import("./schemas").servicos_adicionaisSchema
>;
export type ServicosAdicionaisRelations = z.infer<
	typeof import("./schemas").servicos_adicionaisRelationSchema
>;

export type ServicosAdicionaisRelationKey = keyof ServicosAdicionaisRelations;
