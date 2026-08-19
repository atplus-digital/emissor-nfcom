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
export type ContratosIxcGeral = z.infer<
	typeof import("./schemas").contratos_ixc_geralSchema
>;
export type ContratosIxcGeralRelations = z.infer<
	typeof import("./schemas").contratos_ixc_geralRelationSchema
>;

export type ContratosIxcGeralRelationKey = keyof ContratosIxcGeralRelations;
