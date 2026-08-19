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
export type Departments = z.infer<typeof import("./schemas").departmentsSchema>;
export type DepartmentsRelations = z.infer<
	typeof import("./schemas").departmentsRelationSchema
>;

export type DepartmentsRelationKey = keyof DepartmentsRelations;
