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
export type NfcomFaturas = z.infer<
	typeof import("./schemas").nfcom_faturasSchema
>;
export type NfcomFaturasRelations = z.infer<
	typeof import("./schemas").nfcom_faturasRelationSchema
>;

export type NfcomFaturasRelationKey = keyof NfcomFaturasRelations;
