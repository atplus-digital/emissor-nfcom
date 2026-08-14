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
export type TemplatesTickets = z.infer<
	typeof import("./schemas").templates_ticketsSchema
>;
export type TemplatesTicketsRelations = z.infer<
	typeof import("./schemas").templates_ticketsRelationSchema
>;

export type TemplatesTicketsRelationKey = keyof TemplatesTicketsRelations;
