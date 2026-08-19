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
export type Parceiros = z.infer<typeof import("./schemas").parceirosSchema>;
export type ParceirosRelations = z.infer<
	typeof import("./schemas").parceirosRelationSchema
>;

export type ParceirosRelationKey = keyof ParceirosRelations;
