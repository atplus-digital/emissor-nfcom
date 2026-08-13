import type { EnumOption } from "@generators/pipelines/generate-types/@types/generation";
import {
	generateContent,
	generateFileHeader,
	generateLabelsContent,
	generateSchemasContent,
} from "@generators/pipelines/generate-types/content/assembly";
import { generateCollectionInterfaces } from "@generators/pipelines/generate-types/content/interfaces";
import { describe, expect, it } from "vitest";
import {
	createMockCollectionTypesMap,
	createMockGeneratedTypes,
} from "../factories";

describe("content generation", () => {
	describe("generateFileHeader", () => {
		it("returns the expected comment block", () => {
			const result = generateFileHeader();
			expect(result).toContain("Arquivo gerado automaticamente");
			expect(result).toContain("NÃO EDITAR MANUALMENTE");
			expect(result).toContain("biome-ignore-all");
		});
	});

	describe("generateCollectionInterfaces", () => {
		it("orchestrates base, relations and relation key", () => {
			const types = createMockGeneratedTypes(
				{ id: "number" },
				{
					departamento: {
						targetCollection: "departments",
						type: "belongsTo",
					},
				},
			);
			const result = generateCollectionInterfaces("users", types);

			expect(result.baseInterface).toContain("export interface Users {");
			expect(result.relationsInterface).toContain(
				"export type UsersRelations = {",
			);
			expect(result.relationKeyType).toContain(
				"export type UsersRelationKey = keyof UsersRelations;",
			);
		});

		it("uses named enum type for fields with enum values", () => {
			const enumOptions: EnumOption[] = [
				{ value: "0", label: "Com Pendências" },
				{ value: "1", label: "Sem Pendências" },
			];
			const types = createMockGeneratedTypes(
				{
					id: "number",
					f_analise_ixc: '"0" | "1"',
				},
				{},
				{ f_analise_ixc: enumOptions },
			);

			const result = generateCollectionInterfaces("empresas", types);
			expect(result.baseInterface).toContain(
				"f_analise_ixc: EmpresasAnaliseIxc;",
			);
		});
	});

	describe("generateLabelsContent", () => {
		it("includes enum labels when enums exist", () => {
			const types = createMockGeneratedTypes(
				{},
				{},
				{ f_status: [{ value: "a", label: "A" }] },
			);
			const result = generateLabelsContent("t_users", types);
			expect(result).toContain("USERS_STATUS_LABELS");
		});
	});

	describe("generateSchemasContent", () => {
		it("generates zod schemas for scalars and relations", () => {
			const types = createMockGeneratedTypes({ id: "number" });
			const collections = createMockCollectionTypesMap({
				users: { scalars: { id: "number" } },
			});
			const result = generateSchemasContent("users", types, {
				allCollectionsMap: collections,
			});
			expect(result).toContain("usersBaseSchema");
			expect(result).toContain('import { z } from "zod"');
		});
	});

	describe("generateContent", () => {
		it("sorts collections alphabetically in main output", () => {
			const collections = createMockCollectionTypesMap({
				z_collection: { scalars: { id: "number" } },
				a_collection: { scalars: { id: "number" } },
			});
			const result = generateContent(collections);
			const aIndex = result.indexOf("export interface ACollection");
			const zIndex = result.indexOf("export interface ZCollection");
			expect(aIndex).toBeGreaterThan(-1);
			expect(zIndex).toBeGreaterThan(-1);
			expect(aIndex).toBeLessThan(zIndex);
		});
	});
});
