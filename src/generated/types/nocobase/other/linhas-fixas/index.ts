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
export type LinhasFixas = z.infer<
	typeof import("./schemas").linhas_fixasSchema
>;
export type LinhasFixasRelations = z.infer<
	typeof import("./schemas").linhas_fixasRelationSchema
>;

export type LinhasFixasRelationKey = keyof LinhasFixasRelations;
