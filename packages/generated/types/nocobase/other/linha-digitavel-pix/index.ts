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
export type LinhaDigitavelPix = z.infer<
	typeof import("./schemas").linha_digitavel_pixSchema
>;
export type LinhaDigitavelPixRelations = z.infer<
	typeof import("./schemas").linha_digitavel_pixRelationSchema
>;

export type LinhaDigitavelPixRelationKey = keyof LinhaDigitavelPixRelations;
