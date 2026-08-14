/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: pnpm generate-types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */

import { z } from "zod";
import { usersBaseSchema } from "../../users/schemas";
import { aiemployeesBaseSchema } from "../aiemployees/schemas";
import { departmentsBaseSchema } from "../departments/schemas";

export const TABLE_NAME = "roles";
export const TABLE_LABEL = "Funções";

// ============================================================
// BASE SCHEMA (campos escalares)
// ============================================================
export const rolesBaseSchema = z.object({
	sort: z.number(),
	allowConfigure: z.boolean(),
	allowNewAiEmployee: z.boolean(),
	allowNewMenu: z.boolean(),
	allowNewMobileMenu: z.boolean(),
	default: z.boolean(),
	description: z.string(),
	hidden: z.boolean(),
	name: z.string(),
	snippets: z.string(),
	strategy: z.string(),
	title: z.string(),
});

// ============================================================
// RELATION SCHEMA (campos de relação)
// ============================================================
export const rolesRelationSchema = z.object({
	aiEmployees: z.lazy(() => aiemployeesBaseSchema.array()),
	departments: z.lazy(() => departmentsBaseSchema.array()),
	desktopRoutes: z.number().array(),
	menuUiSchemas: z.number().array(),
	mobileRoutes: z.number().array(),
	resources: z.number().array(),
	users: z.lazy(() => usersBaseSchema.array()),
});

export const RELATION_TARGETS = {
	aiEmployees: "aiEmployees",
	departments: "departments",
	users: "users",
} as const;

// ============================================================
// SCHEMA PRINCIPAL (validação completa)
// ============================================================
export const rolesSchema = rolesBaseSchema.extend(rolesRelationSchema.shape);

// ============================================================
// CREATE SCHEMA
// ============================================================
export const rolesCreateSchema = rolesSchema.omit({
	aiEmployees: true,
	departments: true,
	desktopRoutes: true,
	menuUiSchemas: true,
	mobileRoutes: true,
	resources: true,
	users: true,
});

// ============================================================
// UPDATE SCHEMA
// ============================================================
export const rolesUpdateSchema = rolesCreateSchema.partial();
