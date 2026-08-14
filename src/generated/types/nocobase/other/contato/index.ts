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
export type Contato = z.infer<typeof import("./schemas").contatoSchema>;
export type ContatoRelations = z.infer<
	typeof import("./schemas").contatoRelationSchema
>;

export type ContatoRelationKey = keyof ContatoRelations;
