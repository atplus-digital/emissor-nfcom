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
export type Roles = z.infer<typeof import("./schemas").rolesSchema>;
export type RolesRelations = z.infer<
	typeof import("./schemas").rolesRelationSchema
>;

export type RolesRelationKey = keyof RolesRelations;
