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
export type Cidade = z.infer<typeof import("./schemas").cidadeSchema>;
export type CidadeRelations = Record<string, never>;

export type CidadeRelationKey = keyof CidadeRelations;
