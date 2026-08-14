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
export type AnexosTickets = z.infer<
	typeof import("./schemas").anexos_ticketsSchema
>;
export type AnexosTicketsRelations = z.infer<
	typeof import("./schemas").anexos_ticketsRelationSchema
>;

export type AnexosTicketsRelationKey = keyof AnexosTicketsRelations;
