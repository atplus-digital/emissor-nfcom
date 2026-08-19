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
export type NfcomCobrancas = z.infer<
	typeof import("./schemas").nfcom_cobrancasSchema
>;
export type NfcomCobrancasRelations = z.infer<
	typeof import("./schemas").nfcom_cobrancasRelationSchema
>;

export type NfcomCobrancasRelationKey = keyof NfcomCobrancasRelations;
