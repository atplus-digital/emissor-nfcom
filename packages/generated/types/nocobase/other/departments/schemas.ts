/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: bun run generate:types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */

import { z } from "zod";
import { usersBaseSchema } from "../../users/schemas";
import { rolesBaseSchema } from "../roles/schemas";

export const TABLE_NAME = "departments";
export const TABLE_LABEL = "Departamentos";

// ============================================================
// BASE SCHEMA (campos escalares)
// ============================================================
export const departmentsBaseSchema = z.object({
	id: z.number(),
	sort: z.number(),
	isLeaf: z.boolean(),
	title: z.string(),
	updatedById: z.string(),
	createdById: z.string(),
});

// ============================================================
// RELATION SCHEMA (campos de relação)
// ============================================================
export const departmentsRelationSchema = z.object({
	children: z.lazy(() => departmentsBaseSchema.array()),
	createdBy: z.lazy(() => usersBaseSchema.nullable()),
	members: z.lazy(() => usersBaseSchema.array()),
	owners: z.lazy(() => usersBaseSchema.array()),
	parent: z.lazy(() => departmentsBaseSchema.nullable()),
	roles: z.lazy(() => rolesBaseSchema.array()),
	updatedBy: z.lazy(() => usersBaseSchema.nullable()),
});

export const RELATION_TARGETS = {
	createdBy: "users",
	members: "users",
	owners: "users",
	roles: "roles",
	updatedBy: "users",
} as const;

// ============================================================
// SCHEMA PRINCIPAL (validação completa)
// ============================================================
export const departmentsSchema = departmentsBaseSchema.extend(
	departmentsRelationSchema.shape,
);

// ============================================================
// CREATE SCHEMA
// ============================================================
export const departmentsCreateSchema = departmentsSchema.omit({
	children: true,
	createdBy: true,
	createdById: true,
	id: true,
	members: true,
	owners: true,
	parent: true,
	roles: true,
	updatedBy: true,
	updatedById: true,
});

// ============================================================
// UPDATE SCHEMA
// ============================================================
export const departmentsUpdateSchema = departmentsCreateSchema.partial();
