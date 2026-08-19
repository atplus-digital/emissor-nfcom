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
export type Dids = z.infer<typeof import("./schemas").didsSchema>;
export type DidsRelations = z.infer<
	typeof import("./schemas").didsRelationSchema
>;

export type DidsRelationKey = keyof DidsRelations;
