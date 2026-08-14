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
export type IpEncaminhamento = z.infer<
	typeof import("./schemas").ip_encaminhamentoSchema
>;
export type IpEncaminhamentoRelations = z.infer<
	typeof import("./schemas").ip_encaminhamentoRelationSchema
>;

export type IpEncaminhamentoRelationKey = keyof IpEncaminhamentoRelations;
