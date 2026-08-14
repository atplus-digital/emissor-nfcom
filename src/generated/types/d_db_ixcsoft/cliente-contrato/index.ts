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
export type ClienteContrato = z.infer<
	typeof import("./schemas").cliente_contratoSchema
>;
export type ClienteContratoRelations = z.infer<
	typeof import("./schemas").cliente_contratoRelationSchema
>;

export type ClienteContratoRelationKey = keyof ClienteContratoRelations;
