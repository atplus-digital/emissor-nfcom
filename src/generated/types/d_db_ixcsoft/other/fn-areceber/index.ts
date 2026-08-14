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
export type FnAreceber = z.infer<typeof import("./schemas").fn_areceberSchema>;
export type FnAreceberRelations = Record<string, never>;

export type FnAreceberRelationKey = keyof FnAreceberRelations;
