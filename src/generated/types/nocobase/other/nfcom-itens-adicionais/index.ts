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
export type NfcomItensAdicionais = z.infer<
	typeof import("./schemas").nfcom_itens_adicionaisSchema
>;
export type NfcomItensAdicionaisRelations = z.infer<
	typeof import("./schemas").nfcom_itens_adicionaisRelationSchema
>;

export type NfcomItensAdicionaisRelationKey =
	keyof NfcomItensAdicionaisRelations;
