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
export type AnexosRespostas = z.infer<
	typeof import("./schemas").anexos_respostasSchema
>;
export type AnexosRespostasRelations = z.infer<
	typeof import("./schemas").anexos_respostasRelationSchema
>;

export type AnexosRespostasRelationKey = keyof AnexosRespostasRelations;
