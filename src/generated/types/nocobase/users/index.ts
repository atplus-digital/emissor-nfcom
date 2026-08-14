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
export type Users = z.infer<typeof import("./schemas").usersSchema>;
export type UsersRelations = z.infer<
	typeof import("./schemas").usersRelationSchema
>;

export type UsersRelationKey = keyof UsersRelations;
