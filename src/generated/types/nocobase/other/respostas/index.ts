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
export type Respostas = z.infer<typeof import("./schemas").respostasSchema>;
export type RespostasRelations = z.infer<
	typeof import("./schemas").respostasRelationSchema
>;

export type RespostasRelationKey = keyof RespostasRelations;
