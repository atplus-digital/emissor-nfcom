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
export type ContratosIxc = z.infer<
	typeof import("./schemas").contratos_ixcSchema
>;
export type ContratosIxcRelations = z.infer<
	typeof import("./schemas").contratos_ixcRelationSchema
>;

export type ContratosIxcRelationKey = keyof ContratosIxcRelations;
