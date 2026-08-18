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
export type Tarifas = z.infer<typeof import("./schemas").tarifasSchema>;
export type TarifasRelations = z.infer<
	typeof import("./schemas").tarifasRelationSchema
>;

export type TarifasRelationKey = keyof TarifasRelations;
