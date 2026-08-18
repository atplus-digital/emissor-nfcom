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
export type Cdr = z.infer<typeof import("./schemas").cdrSchema>;
export type CdrRelations = z.infer<
	typeof import("./schemas").cdrRelationSchema
>;

export type CdrRelationKey = keyof CdrRelations;
