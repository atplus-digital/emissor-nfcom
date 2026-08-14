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
export type NfcomItens = z.infer<typeof import("./schemas").nfcom_itensSchema>;
export type NfcomItensRelations = z.infer<
	typeof import("./schemas").nfcom_itensRelationSchema
>;

export type NfcomItensRelationKey = keyof NfcomItensRelations;
