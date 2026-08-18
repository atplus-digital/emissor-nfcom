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
export type Faturas = z.infer<typeof import("./schemas").faturasSchema>;
export type FaturasRelations = z.infer<
	typeof import("./schemas").faturasRelationSchema
>;

export type FaturasRelationKey = keyof FaturasRelations;
