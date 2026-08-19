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
export type Tickets = z.infer<typeof import("./schemas").ticketsSchema>;
export type TicketsRelations = z.infer<
	typeof import("./schemas").ticketsRelationSchema
>;

export type TicketsRelationKey = keyof TicketsRelations;
