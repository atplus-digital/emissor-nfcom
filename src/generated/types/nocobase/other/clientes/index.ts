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
export type Clientes = z.infer<typeof import("./schemas").clientesSchema>;
export type ClientesRelations = z.infer<
	typeof import("./schemas").clientesRelationSchema
>;

export type ClientesRelationKey = keyof ClientesRelations;
