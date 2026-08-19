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
export type TagsTickets = z.infer<
	typeof import("./schemas").tags_ticketsSchema
>;
export type TagsTicketsRelations = z.infer<
	typeof import("./schemas").tags_ticketsRelationSchema
>;

export type TagsTicketsRelationKey = keyof TagsTicketsRelations;
