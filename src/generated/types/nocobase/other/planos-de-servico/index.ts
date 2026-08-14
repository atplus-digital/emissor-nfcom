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
export type PlanosDeServico = z.infer<
	typeof import("./schemas").planos_de_servicoSchema
>;
export type PlanosDeServicoRelations = z.infer<
	typeof import("./schemas").planos_de_servicoRelationSchema
>;

export type PlanosDeServicoRelationKey = keyof PlanosDeServicoRelations;
