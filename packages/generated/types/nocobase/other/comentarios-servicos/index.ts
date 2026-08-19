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
export type ComentariosServicos = z.infer<
	typeof import("./schemas").comentarios_servicosSchema
>;
export type ComentariosServicosRelations = z.infer<
	typeof import("./schemas").comentarios_servicosRelationSchema
>;

export type ComentariosServicosRelationKey = keyof ComentariosServicosRelations;
