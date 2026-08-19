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
export type NfcomErros = z.infer<typeof import("./schemas").nfcom_errosSchema>;
export type NfcomErrosRelations = z.infer<
	typeof import("./schemas").nfcom_errosRelationSchema
>;

export type NfcomErrosRelationKey = keyof NfcomErrosRelations;
