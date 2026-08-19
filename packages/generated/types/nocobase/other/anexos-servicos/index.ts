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
export type FAnexosServicos = z.infer<
	typeof import("./schemas").f_anexos_servicosSchema
>;
export type FAnexosServicosRelations = z.infer<
	typeof import("./schemas").f_anexos_servicosRelationSchema
>;

export type FAnexosServicosRelationKey = keyof FAnexosServicosRelations;
