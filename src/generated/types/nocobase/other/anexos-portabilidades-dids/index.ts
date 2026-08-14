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
export type AnexosPortabilidadesDids = z.infer<
	typeof import("./schemas").anexos_portabilidades_didsSchema
>;
export type AnexosPortabilidadesDidsRelations = z.infer<
	typeof import("./schemas").anexos_portabilidades_didsRelationSchema
>;

export type AnexosPortabilidadesDidsRelationKey =
	keyof AnexosPortabilidadesDidsRelations;
