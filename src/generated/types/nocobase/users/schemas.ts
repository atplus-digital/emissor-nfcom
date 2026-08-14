/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: pnpm generate-types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */

import { z } from "zod";
import { aiemployeesBaseSchema } from "../other/aiemployees/schemas";
import { departmentsBaseSchema } from "../other/departments/schemas";
import { parceirosBaseSchema } from "../other/parceiros/schemas";
import { rolesBaseSchema } from "../other/roles/schemas";

export const TABLE_NAME = "users";
export const TABLE_LABEL = "users";

// ============================================================
// BASE SCHEMA (campos escalares)
// ============================================================
export const usersBaseSchema = z.object({
	id: z.number(),
	sort: z.number(),
	f_fk_parceiro: z.number(),
	appLang: z.string(),
	email: z.string(),
	mainDepartmentId: z.number(),
	nickname: z.string(),
	password: z.string(),
	passwordChangeTz: z.number(),
	phone: z.string(),
	resetToken: z.string(),
	systemSettings: z.string(),
	username: z.string(),
	updatedAt: z.string(),
	updatedById: z.string(),
	createdAt: z.string(),
	createdById: z.string(),
});

// ============================================================
// RELATION SCHEMA (campos de relação)
// ============================================================
export const usersRelationSchema = z.object({
	aiEmployees: z.lazy(() => aiemployeesBaseSchema.array()),
	createdBy: z.lazy(() => usersBaseSchema.nullable()),
	departments: z.lazy(() => departmentsBaseSchema.array()),
	f_fk_parceiros: z.lazy(() => parceirosBaseSchema.array()),
	mainDepartment: z.lazy(() => departmentsBaseSchema.nullable()),
	roles: z.lazy(() => rolesBaseSchema.array()),
	updatedBy: z.lazy(() => usersBaseSchema.nullable()),
});

export const RELATION_TARGETS = {
	aiEmployees: "aiEmployees",
	departments: "departments",
	f_fk_parceiros: "t_parceiros",
	mainDepartment: "departments",
	roles: "roles",
} as const;

// ============================================================
// SCHEMA PRINCIPAL (validação completa)
// ============================================================
export const usersSchema = usersBaseSchema.extend(usersRelationSchema.shape);

// ============================================================
// CREATE SCHEMA
// ============================================================
export const usersCreateSchema = usersSchema.omit({
	aiEmployees: true,
	createdAt: true,
	createdBy: true,
	createdById: true,
	departments: true,
	f_fk_parceiros: true,
	id: true,
	mainDepartment: true,
	roles: true,
	updatedAt: true,
	updatedBy: true,
	updatedById: true,
});

// ============================================================
// UPDATE SCHEMA
// ============================================================
export const usersUpdateSchema = usersCreateSchema.partial();
