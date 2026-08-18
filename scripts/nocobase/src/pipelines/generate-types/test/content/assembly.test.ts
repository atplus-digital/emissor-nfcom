import {
	_generateContentForCollections,
	generateContent,
	generateFileHeader,
	generateIndexContent,
	generateLabelsContent,
	generateSchemasContent,
} from "@generators/pipelines/generate-types/content/assembly";
import { describe, expect, it } from "bun:test";
import {
	createMockCollectionTypesMap,
	createMockGeneratedTypes,
} from "../factories";

describe("assembly exports", () => {
	describe("generateFileHeader", () => {
		it("includes auto-generated warning banner", () => {
			const header = generateFileHeader();
			expect(header).toContain("Arquivo gerado automaticamente");
			expect(header).toContain("bun run generate:types");
		});
	});

	describe("generateIndexContent", () => {
		it("generates split barrel with zod infer and label re-exports", () => {
			const types = createMockGeneratedTypes(
				{ id: "number", f_status: "string" },
				{},
				{ f_status: [{ value: "a", label: "A" }] },
			);

			const result = generateIndexContent("t_users", types, undefined, true);

			expect(result).toContain('import { z } from "zod";');
			expect(result).toContain('export * from "./labels";');
			expect(result).toContain('export * from "./schemas";');
			expect(result).toContain('z.infer<typeof import("./schemas").');
			expect(result).toContain("UsersRelations");
		});

		it("generates non-split barrel with base interface block", () => {
			const types = createMockGeneratedTypes({ id: "number" });
			const result = generateIndexContent("users", types, undefined, false);

			expect(result).toContain("export interface Users {");
			expect(result).not.toContain('import { z } from "zod";');
		});

		it("uses Record<string, never> for empty split collection", () => {
			const types = createMockGeneratedTypes();
			const result = generateIndexContent("users", types, undefined, true);

			expect(result).toContain("export type Users = Record<string, never>;");
		});

		it("always re-exports labels barrel for analytics catalog loading", () => {
			const types = createMockGeneratedTypes({ id: "number" });
			const result = generateIndexContent("users", types, undefined, true);

			expect(result).toContain('export * from "./labels";');
			expect(result).toContain('export * from "./schemas";');
		});
	});

	describe("generateContent", () => {
		it("deduplicates repeated zod imports in consolidated output", () => {
			const collections = createMockCollectionTypesMap({
				users: {
					scalars: { f_status: "string" },
					enums: { f_status: [{ value: "a", label: "A" }] },
				},
				posts: {
					scalars: { f_flag: "string" },
					enums: { f_flag: [{ value: "x", label: "X" }] },
				},
			});

			const result = generateContent(collections);
			const zodImportCount = (result.match(/import \{ z \} from "zod";/g) ?? [])
				.length;

			expect(zodImportCount).toBe(1);
		});

		it("applies base interface naming suffix in consolidated interfaces", () => {
			const collections = createMockCollectionTypesMap({
				users: { scalars: { id: "number" } },
			});

			const result = generateContent(collections, { suffix: "Entity" });

			expect(result).toContain("export interface UsersEntity {");
		});

		it("generates consolidated output without zod imports when no enums exist", () => {
			const collections = createMockCollectionTypesMap({
				users: { scalars: { id: "number", name: "string" } },
			});

			const result = generateContent(collections);

			expect(result).not.toContain('import { z } from "zod";');
			expect(result).toContain("export interface Users {");
		});

		it("returns content unchanged when split collection mode is enabled", () => {
			const collections = createMockCollectionTypesMap({
				users: {
					scalars: { id: "number" },
					enums: { f_status: [{ value: "a", label: "A" }] },
				},
			});

			const splitResult = _generateContentForCollections(
				collections,
				true,
				undefined,
				false,
				true,
			);

			expect(splitResult).toContain("TYPE PRINCIPAL");
			expect(splitResult).toContain("z.infer<typeof usersSchema>");
			expect(splitResult).toContain("BASE SCHEMA");
			expect(splitResult).toContain("CREATE SCHEMA");
		});

		it("omits header when includeHeader is false", () => {
			const collections = createMockCollectionTypesMap({
				users: { scalars: { id: "number" } },
			});

			const result = _generateContentForCollections(collections, false);

			expect(result).not.toContain("Arquivo gerado automaticamente");
			expect(result).toContain("export interface Users {");
		});

		it("includes TABLE_NAME const when includeSourceTableConst is true", () => {
			const collections = createMockCollectionTypesMap({
				users: {
					scalars: { id: "number" },
					tableLabel: "Usuários",
				},
			});

			const result = _generateContentForCollections(
				collections,
				false,
				undefined,
				true,
			);

			expect(result).toContain('export const TABLE_NAME = "users";');
			expect(result).toContain('export const TABLE_LABEL = "Usuários";');
		});

		it("generates split collection output with relation schemas", () => {
			const collections = createMockCollectionTypesMap({
				users: {
					scalars: { id: "number" },
					relations: {
						f_order: { type: "belongsTo", targetCollection: "orders" },
					},
				},
				orders: { scalars: { id: "number" } },
			});

			const result = _generateContentForCollections(
				collections,
				true,
				undefined,
				false,
				true,
			);

			expect(result).toContain("RELATION SCHEMA");
			expect(result).toContain("usersRelationSchema");
		});

		it("skips optional schema sections for empty split collections", () => {
			const collections = createMockCollectionTypesMap({
				empty: {},
			});

			const result = _generateContentForCollections(
				collections,
				true,
				undefined,
				false,
				true,
			);

			expect(result).toContain("TYPE PRINCIPAL");
			expect(result).not.toContain("RELATION SCHEMA");
			expect(result).not.toContain("CREATE SCHEMA");
			expect(result).not.toContain("UPDATE SCHEMA");
		});
	});

	describe("generateSchemasContent", () => {
		it("imports external schemas for cross-collection relations in split layout", () => {
			const users = createMockGeneratedTypes(
				{ id: "number" },
				{ f_order: { type: "belongsTo", targetCollection: "t_orders" } },
			);
			const all = createMockCollectionTypesMap({
				users: {
					scalars: { id: "number" },
					relations: {
						f_order: { type: "belongsTo", targetCollection: "t_orders" },
					},
				},
				t_orders: { scalars: { id: "number" } },
			});

			const result = generateSchemasContent("users", users, undefined, {
				allCollectionsMap: all,
				splitCollectionNames: new Set(["t_orders"]),
				currentCollectionInOtherFolder: true,
			});

			expect(result).toMatch(/from ["']\.\.\/\.\.\/orders\/schemas["']/);
			expect(result).toContain("usersBaseSchema");
			expect(result).toContain("CREATE SCHEMA");
			expect(result).toContain("UPDATE SCHEMA");
		});

		it("uses multiline enum schema imports when many enum fields exist", () => {
			const enumEntries = Object.fromEntries(
				Array.from({ length: 6 }, (_, i) => [
					`f_enum_${i}`,
					[{ value: String(i), label: `L${i}` }],
				]),
			);
			const types = createMockGeneratedTypes(
				Object.fromEntries(
					Array.from({ length: 6 }, (_, i) => [`f_enum_${i}`, "string"]),
				),
				{},
				enumEntries,
			);

			const result = generateSchemasContent("t_users", types);

			expect(result).toContain("import {\n");
			expect(result).toContain('} from "./labels";');
		});

		it("uses multiline external schema imports when many relations exist", () => {
			const relations = Object.fromEntries(
				Array.from({ length: 5 }, (_, i) => [
					`f_rel_${i}`,
					{ type: "belongsTo" as const, targetCollection: `t_target_${i}` },
				]),
			);
			const scalars = Object.fromEntries(
				Array.from({ length: 5 }, (_, i) => [`f_rel_${i}`, "number"]),
			);
			const types = createMockGeneratedTypes(scalars, relations);
			const all = createMockCollectionTypesMap({
				users: { scalars, relations },
				...Object.fromEntries(
					Array.from({ length: 5 }, (_, i) => [
						`t_target_${i}`,
						{ scalars: { id: "number" } },
					]),
				),
			});

			const result = generateSchemasContent("users", types, undefined, {
				allCollectionsMap: all,
				splitCollectionNames: new Set(["t_target_0", "t_target_1"]),
				currentCollectionInOtherFolder: false,
			});

			expect(result).toContain('from "../other/');
			expect(result).toContain("import {");
		});

		it("imports from other folder when split layout target is not a split collection", () => {
			const types = createMockGeneratedTypes(
				{ id: "number" },
				{ f_ref: { type: "belongsTo", targetCollection: "legacy" } },
			);
			const all = createMockCollectionTypesMap({
				users: {
					scalars: { id: "number" },
					relations: {
						f_ref: { type: "belongsTo", targetCollection: "legacy" },
					},
				},
				legacy: { scalars: { id: "number" } },
			});

			const result = generateSchemasContent("t_users", types, undefined, {
				allCollectionsMap: all,
				splitCollectionNames: new Set(["t_users"]),
				currentCollectionInOtherFolder: false,
			});

			expect(result).toContain('../other/legacy/schemas"');
		});

		it("imports from parent folder when collection lives in other folder and target is not split", () => {
			const types = createMockGeneratedTypes(
				{ id: "number" },
				{ f_ref: { type: "belongsTo", targetCollection: "legacy" } },
			);
			const all = createMockCollectionTypesMap({
				users: {
					scalars: { id: "number" },
					relations: {
						f_ref: { type: "belongsTo", targetCollection: "legacy" },
					},
				},
				legacy: { scalars: { id: "number" } },
			});

			const result = generateSchemasContent("users", types, undefined, {
				allCollectionsMap: all,
				splitCollectionNames: new Set(["t_users"]),
				currentCollectionInOtherFolder: true,
			});

			expect(result).toContain('../legacy/schemas"');
		});

		it("uses flat import path when split folder layout is disabled", () => {
			const types = createMockGeneratedTypes(
				{ id: "number" },
				{ f_ref: { type: "belongsTo", targetCollection: "legacy" } },
			);
			const all = createMockCollectionTypesMap({
				users: {
					scalars: { id: "number" },
					relations: {
						f_ref: { type: "belongsTo", targetCollection: "legacy" },
					},
				},
				legacy: { scalars: { id: "number" } },
			});

			const result = generateSchemasContent("users", types, undefined, {
				allCollectionsMap: all,
				splitCollectionNames: new Set(),
				currentCollectionInOtherFolder: false,
			});

			expect(result).toContain('../legacy/schemas"');
			expect(result).not.toContain("../other/");
		});

		it("resolves same-folder split import path when target is split collection", () => {
			const types = createMockGeneratedTypes(
				{ id: "number" },
				{ f_order: { type: "belongsTo", targetCollection: "t_orders" } },
			);
			const all = createMockCollectionTypesMap({
				users: {
					scalars: { id: "number" },
					relations: {
						f_order: { type: "belongsTo", targetCollection: "t_orders" },
					},
				},
				t_orders: { scalars: { id: "number" } },
			});

			const result = generateSchemasContent("users", types, undefined, {
				allCollectionsMap: all,
				splitCollectionNames: new Set(["t_orders"]),
				currentCollectionInOtherFolder: false,
			});

			expect(result).toContain('from "../orders/schemas"');
		});

		it("uses single-line enum schema imports when five or fewer enum fields exist", () => {
			const types = createMockGeneratedTypes(
				{ f_status: "string", f_type: "string" },
				{},
				{
					f_status: [{ value: "a", label: "A" }],
					f_type: [{ value: "b", label: "B" }],
				},
			);

			const result = generateSchemasContent("t_users", types);

			expect(result).toMatch(
				/import \{ usersStatusSchema, usersTypeSchema \} from "\.\/labels";/,
			);
		});

		it("skips relations with empty target, self-reference, or unknown collection", () => {
			const types = createMockGeneratedTypes(
				{ id: "number" },
				{
					f_self: { type: "belongsTo", targetCollection: "users" },
					f_empty: { type: "belongsTo", targetCollection: "   " },
					f_unknown: { type: "belongsTo", targetCollection: "missing" },
					f_valid: { type: "belongsTo", targetCollection: "orders" },
				},
			);
			const all = createMockCollectionTypesMap({
				users: {
					scalars: { id: "number" },
					relations: {
						f_self: { type: "belongsTo", targetCollection: "users" },
						f_empty: { type: "belongsTo", targetCollection: "   " },
						f_unknown: { type: "belongsTo", targetCollection: "missing" },
						f_valid: { type: "belongsTo", targetCollection: "orders" },
					},
				},
				orders: { scalars: { id: "number" } },
			});

			const result = generateSchemasContent("users", types, undefined, {
				allCollectionsMap: all,
			});

			expect(result).toContain("ordersBaseSchema");
			expect(result).not.toContain("missing");
			expect(result).not.toMatch(/usersBaseSchema.*from/);
		});

		it("merges external schema imports for multiple relations to the same target", () => {
			const types = createMockGeneratedTypes(
				{ f_order_a: "number", f_order_b: "number" },
				{
					f_order_a: { type: "belongsTo", targetCollection: "orders" },
					f_order_b: { type: "hasMany", targetCollection: "orders" },
				},
			);
			const all = createMockCollectionTypesMap({
				users: {
					scalars: { f_order_a: "number", f_order_b: "number" },
					relations: {
						f_order_a: { type: "belongsTo", targetCollection: "orders" },
						f_order_b: { type: "hasMany", targetCollection: "orders" },
					},
				},
				orders: { scalars: { id: "number" } },
			});

			const result = generateSchemasContent("users", types, undefined, {
				allCollectionsMap: all,
			});

			expect(result).toMatch(
				/import \{ ordersBaseSchema \} from "\.\.\/orders\/schemas";/,
			);
		});

		it("uses multiline external schema imports when one path has many targets", () => {
			const sharedFolderTargets = [
				"t_shared",
				"f_shared",
				"t_shared_extra",
				"f_shared_extra",
				"shared",
			];
			const relations = Object.fromEntries(
				sharedFolderTargets.map((target, i) => [
					`f_rel_${i}`,
					{ type: "belongsTo" as const, targetCollection: target },
				]),
			);
			const scalars = Object.fromEntries(
				sharedFolderTargets.map((_, i) => [`f_rel_${i}`, "number"]),
			);
			const types = createMockGeneratedTypes(scalars, relations);
			const all = createMockCollectionTypesMap({
				users: { scalars, relations },
				...Object.fromEntries(
					sharedFolderTargets.map((target) => [
						target,
						{ scalars: { id: "number" } },
					]),
				),
			});

			const result = generateSchemasContent("users", types, undefined, {
				allCollectionsMap: all,
				splitCollectionNames: new Set(),
				currentCollectionInOtherFolder: false,
			});

			expect(result).toContain("import {");
			expect(result).toContain("sharedBaseSchema,");
			expect(result).toContain('} from "../shared/schemas";');
		});

		it("omits main, create, and update schema sections for empty collections", () => {
			const types = createMockGeneratedTypes();

			const result = generateSchemasContent("users", types);

			expect(result).toContain("usersBaseSchema = z.object({");
			expect(result).not.toContain("SCHEMA PRINCIPAL");
			expect(result).not.toContain("CREATE SCHEMA");
			expect(result).not.toContain("UPDATE SCHEMA");
		});

		it("normalizes blank collection names for TABLE_NAME const", () => {
			const types = createMockGeneratedTypes({ id: "number" });

			const result = generateSchemasContent("   ", types);

			expect(result).toContain('export const TABLE_NAME = "   ";');
		});

		it("resolves base schema names for collection named t", () => {
			const types = createMockGeneratedTypes(
				{ id: "number" },
				{ f_ref: { type: "belongsTo", targetCollection: "t" } },
			);
			const all = createMockCollectionTypesMap({
				users: {
					scalars: { id: "number" },
					relations: {
						f_ref: { type: "belongsTo", targetCollection: "t" },
					},
				},
				t: { scalars: { id: "number" } },
			});

			const result = generateSchemasContent("users", types, undefined, {
				allCollectionsMap: all,
			});

			expect(result).toContain("tBaseSchema");
		});

		it("prefixes enum schema names that start with a digit", () => {
			const types = createMockGeneratedTypes(
				{ f_status: "string" },
				{},
				{ f_status: [{ value: "a", label: "A" }] },
			);

			const result = generateSchemasContent("t_123", types);

			expect(result).toContain("_123StatusSchema");
		});

		it("adds blank line after imports when only external schema imports exist", () => {
			const types = createMockGeneratedTypes(
				{ id: "number" },
				{ f_ref: { type: "belongsTo", targetCollection: "orders" } },
			);
			const all = createMockCollectionTypesMap({
				users: {
					scalars: { id: "number" },
					relations: {
						f_ref: { type: "belongsTo", targetCollection: "orders" },
					},
				},
				orders: { scalars: { id: "number" } },
			});

			const result = generateSchemasContent("users", types, undefined, {
				allCollectionsMap: all,
			});

			expect(result).toMatch(
				/from "\.\.\/orders\/schemas";\n\nexport const TABLE_NAME/,
			);
			expect(result).not.toContain('from "./labels"');
		});

		it("works without allCollectionsMap for relation resolution", () => {
			const types = createMockGeneratedTypes(
				{ id: "number" },
				{ f_ref: { type: "belongsTo", targetCollection: "orders" } },
			);

			const result = generateSchemasContent("users", types);

			expect(result).toContain("usersRelationSchema");
			expect(result).not.toContain("../orders/schemas");
		});
	});

	describe("generateLabelsContent", () => {
		it("includes field labels map when labels exist", () => {
			const types = createMockGeneratedTypes(
				{ id: "number" },
				{},
				{},
				{ id: "Identifier" },
			);

			const result = generateLabelsContent("users", types);

			expect(result).toContain("USERS_FIELD_LABELS");
			expect(result).toContain("\"id\": 'Identifier'");
		});

		it("sorts field labels alphabetically", () => {
			const types = createMockGeneratedTypes(
				{ z_field: "string", a_field: "string" },
				{},
				{},
				{ z_field: "Zulu", a_field: "Alpha" },
			);

			const result = generateLabelsContent("users", types);

			expect(result.indexOf("a_field")).toBeLessThan(result.indexOf("z_field"));
		});

		it("escapes quotes and backslashes in field labels", () => {
			const types = createMockGeneratedTypes(
				{ id: "number" },
				{},
				{},
				{ id: "O'Reilly \\ path" },
			);

			const result = generateLabelsContent("users", types);

			expect(result).toContain("O\\'Reilly \\\\ path");
		});

		it("generates field labels only when collection has no enums", () => {
			const types = createMockGeneratedTypes(
				{ id: "number" },
				{},
				{},
				{ id: "ID" },
			);

			const result = generateLabelsContent("users", types);

			expect(result).toContain("USERS_FIELD_LABELS");
			expect(result).not.toContain('import { z } from "zod";');
		});

		it("generates enum-only labels file without auto field labels", () => {
			const types = createMockGeneratedTypes(
				{ f_status: "string" },
				{},
				{ f_status: [{ value: "a", label: "Active" }] },
				{},
			);

			const result = generateLabelsContent("users", types);

			expect(result).toContain('import { z } from "zod";');
			expect(result).not.toContain("USERS_FIELD_LABELS");
			expect(result).toContain("ENUM SCHEMAS");
		});

		it("returns empty FIELD_LABELS and ENUM_LABELS_BY_FIELD when collection has no labels or enums", () => {
			const types = createMockGeneratedTypes();

			const result = generateLabelsContent("users", types);

			expect(result).toContain("export const FIELD_LABELS = {} as const;");
			expect(result).toContain(
				"export const ENUM_LABELS_BY_FIELD = {} as const;",
			);
		});
	});
});
