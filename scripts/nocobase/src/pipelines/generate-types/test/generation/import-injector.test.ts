import type { CollectionTypesMap } from "@generators/pipelines/generate-types/@types/generation";
import {
	createBaseTypeIndex,
	injectTypeImports,
	mergeImportBySource,
	withMainFileImports,
} from "@generators/pipelines/generate-types/content/import-injector";
import { describe, expect, it } from "bun:test";

function createEmptyCollectionTypesMap(
	collectionNames: string[],
): CollectionTypesMap {
	const map: CollectionTypesMap = {};

	for (const collectionName of collectionNames) {
		map[collectionName] = {
			scalars: new Map(),
			relations: new Map(),
			enums: new Map(),
			fieldLabels: new Map(),
			tableLabel: collectionName,
			schemaAvailable: true,
		};
	}

	return map;
}

describe("import-injector", () => {
	describe("withMainFileImports", () => {
		it("adds split collection imports to main file only when needed", () => {
			const collectionTypes = createEmptyCollectionTypesMap([
				"users",
				"t_negociacoes",
			]);
			const baseInterfaceNaming = { prefix: "", suffix: "Base" };
			const baseTypeIndex = createBaseTypeIndex(
				collectionTypes,
				baseInterfaceNaming,
			);
			const content = `/**\n * generated\n */\n\nexport interface UsersRelations {\n\tnegociacao?: NegociacoesBase | null;\n\towner?: UsersBase | null;\n}`;

			const withImports = withMainFileImports(
				content,
				createEmptyCollectionTypesMap(["users"]),
				new Set(["t_negociacoes"]),
				baseTypeIndex,
				baseInterfaceNaming,
			);

			expect(withImports).toContain(
				'import type { NegociacoesBase } from "./negociacoes";',
			);
			expect(withImports).not.toContain(
				'import type { UsersBase } from "./users";',
			);
		});

		it("returns content unchanged when all referenced types are local to main file", () => {
			const collectionTypes = createEmptyCollectionTypesMap(["users"]);
			const baseInterfaceNaming = { prefix: "", suffix: "Base" };
			const baseTypeIndex = createBaseTypeIndex(
				collectionTypes,
				baseInterfaceNaming,
			);
			const content = `export interface UsersBase { id: number; }`;

			const withImports = withMainFileImports(
				content,
				createEmptyCollectionTypesMap(["users"]),
				new Set(),
				baseTypeIndex,
				baseInterfaceNaming,
			);

			expect(withImports).toBe(content);
		});

		it("returns content unchanged when split collection names is empty", () => {
			const collectionTypes = createEmptyCollectionTypesMap(["users"]);
			const baseInterfaceNaming = { prefix: "", suffix: "Base" };
			const baseTypeIndex = createBaseTypeIndex(
				collectionTypes,
				baseInterfaceNaming,
			);
			const content = `export interface UsersBase { id: number; }`;

			const withImports = withMainFileImports(
				content,
				createEmptyCollectionTypesMap(["users"]),
				new Set(),
				baseTypeIndex,
				baseInterfaceNaming,
			);

			expect(withImports).toBe(content);
		});

		it("returns content unchanged when all types are local", () => {
			const collectionTypes = createEmptyCollectionTypesMap(["users", "posts"]);
			const baseInterfaceNaming = { prefix: "", suffix: "Base" };
			const baseTypeIndex = createBaseTypeIndex(
				collectionTypes,
				baseInterfaceNaming,
			);
			const content = `export interface UsersRelations {\n\tposts?: PostsBase[];\n\towner?: UsersBase | null;\n}`;

			const withImports = withMainFileImports(
				content,
				createEmptyCollectionTypesMap(["users", "posts"]),
				new Set(),
				baseTypeIndex,
				baseInterfaceNaming,
			);

			expect(withImports).toBe(content);
		});

		it("returns content unchanged when all referenced types are in main file", () => {
			const collectionTypes = createEmptyCollectionTypesMap(["users", "posts"]);
			const baseInterfaceNaming = { prefix: "", suffix: "Base" };
			const baseTypeIndex = createBaseTypeIndex(
				collectionTypes,
				baseInterfaceNaming,
			);
			const content = `export interface UsersRelations {\n\tposts?: PostsBase[];\n}`;

			const withImports = withMainFileImports(
				content,
				createEmptyCollectionTypesMap(["users", "posts"]),
				new Set(["posts"]),
				baseTypeIndex,
				baseInterfaceNaming,
			);

			expect(withImports).toBe(content);
		});

		it("adds imports only for external split collection types", () => {
			const collectionTypes = createEmptyCollectionTypesMap([
				"users",
				"posts",
				"comments",
			]);
			const baseInterfaceNaming = { prefix: "", suffix: "Base" };
			const baseTypeIndex = createBaseTypeIndex(
				collectionTypes,
				baseInterfaceNaming,
			);
			const content = `export interface UsersRelations {\n\tposts?: PostsBase[];\n\tcomments?: CommentsBase[];\n}`;

			const withImports = withMainFileImports(
				content,
				createEmptyCollectionTypesMap(["users"]),
				new Set(["posts", "comments"]),
				baseTypeIndex,
				baseInterfaceNaming,
			);

			expect(withImports).toContain(
				'import type { CommentsBase } from "./comments";',
			);
			expect(withImports).toContain(
				'import type { PostsBase } from "./posts";',
			);
			expect(withImports).not.toContain(
				'import type { UsersBase } from "./users";',
			);
		});
	});

	describe("injectImports (via withMainFileImports)", () => {
		it("returns content unchanged when no imports needed", () => {
			const collectionTypes = createEmptyCollectionTypesMap(["users"]);
			const baseInterfaceNaming = { prefix: "", suffix: "Base" };
			const baseTypeIndex = createBaseTypeIndex(
				collectionTypes,
				baseInterfaceNaming,
			);
			const content = `export interface UsersBase { id: number; }`;

			const withImports = withMainFileImports(
				content,
				createEmptyCollectionTypesMap(["users"]),
				new Set(),
				baseTypeIndex,
				baseInterfaceNaming,
			);

			expect(withImports).toBe(content);
		});

		it("inserts imports after header comment block", () => {
			const collectionTypes = createEmptyCollectionTypesMap(["users", "posts"]);
			const baseInterfaceNaming = { prefix: "", suffix: "Base" };
			const baseTypeIndex = createBaseTypeIndex(
				collectionTypes,
				baseInterfaceNaming,
			);
			const content = `/**\n * generated\n */\n\nexport interface UsersRelations {\n\tposts?: PostsBase[];\n}`;

			const withImports = withMainFileImports(
				content,
				createEmptyCollectionTypesMap(["users"]),
				new Set(["posts"]),
				baseTypeIndex,
				baseInterfaceNaming,
			);

			expect(withImports).toMatch(
				/\/\*\*\n \* generated\n \*\/\nimport type \{ PostsBase \} from "\.\/posts";\n\nexport interface UsersRelations/,
			);
		});

		it("inserts imports at beginning when no header comment", () => {
			const collectionTypes = createEmptyCollectionTypesMap(["users", "posts"]);
			const baseInterfaceNaming = { prefix: "", suffix: "Base" };
			const baseTypeIndex = createBaseTypeIndex(
				collectionTypes,
				baseInterfaceNaming,
			);
			const content = `export interface UsersRelations {\n\tposts?: PostsBase[];\n}`;

			const withImports = withMainFileImports(
				content,
				createEmptyCollectionTypesMap(["users"]),
				new Set(["posts"]),
				baseTypeIndex,
				baseInterfaceNaming,
			);

			expect(withImports).toMatch(
				/import type \{ PostsBase \} from "\.\/posts";\n\nexport interface UsersRelations/,
			);
		});

		it("formats long import lines as multi-line when exceeding 80 characters", () => {
			const collectionTypes = createEmptyCollectionTypesMap([
				"users",
				"very_long_collection_name_one",
				"very_long_collection_name_two",
				"very_long_collection_name_three",
				"very_long_collection_name_four",
			]);
			const baseInterfaceNaming = { prefix: "", suffix: "Type" };
			const baseTypeIndex = createBaseTypeIndex(
				collectionTypes,
				baseInterfaceNaming,
			);
			const content = `export interface UsersRelations {\n\tfield1?: VeryLongCollectionNameOneType[];\n\tfield2?: VeryLongCollectionNameTwoType[];\n\tfield3?: VeryLongCollectionNameThreeType[];\n\tfield4?: VeryLongCollectionNameFourType[];\n}`;

			const withImports = withMainFileImports(
				content,
				createEmptyCollectionTypesMap(["users"]),
				new Set([
					"very_long_collection_name_one",
					"very_long_collection_name_two",
					"very_long_collection_name_three",
					"very_long_collection_name_four",
				]),
				baseTypeIndex,
				baseInterfaceNaming,
			);

			expect(withImports).toContain("import type {");
			expect(withImports).toContain("VeryLongCollectionNameOneType,");
			expect(withImports).toContain("VeryLongCollectionNameTwoType,");
		});

		it("sorts imports alphabetically by source", () => {
			const collectionTypes = createEmptyCollectionTypesMap([
				"users",
				"zebra",
				"apple",
				"mango",
			]);
			const baseInterfaceNaming = { prefix: "", suffix: "Base" };
			const baseTypeIndex = createBaseTypeIndex(
				collectionTypes,
				baseInterfaceNaming,
			);
			const content = `export interface UsersRelations {\n\tzebra?: ZebraBase | null;\n\tapple?: AppleBase | null;\n\tmango?: MangoBase | null;\n}`;

			const withImports = withMainFileImports(
				content,
				createEmptyCollectionTypesMap(["users"]),
				new Set(["zebra", "apple", "mango"]),
				baseTypeIndex,
				baseInterfaceNaming,
			);

			const appleIndex = withImports.indexOf('from "./apple"');
			const mangoIndex = withImports.indexOf('from "./mango"');
			const zebraIndex = withImports.indexOf('from "./zebra"');

			expect(appleIndex).toBeLessThan(mangoIndex);
			expect(mangoIndex).toBeLessThan(zebraIndex);
		});

		it("sorts type names alphabetically within import", () => {
			const collectionTypes = createEmptyCollectionTypesMap([
				"users",
				"posts",
				"comments",
			]);
			const baseInterfaceNaming = { prefix: "", suffix: "Base" };
			const baseTypeIndex = createBaseTypeIndex(
				collectionTypes,
				baseInterfaceNaming,
			);
			const content = `export interface SharedRelations {\n\tcomments?: CommentsBase[];\n\tposts?: PostsBase[];\n}`;

			const withImports = withMainFileImports(
				content,
				createEmptyCollectionTypesMap(["users"]),
				new Set(["posts", "comments"]),
				baseTypeIndex,
				baseInterfaceNaming,
			);

			const commentsImport = withImports.match(
				/import type \{ ([^}]+) \} from "\.\/comments"/,
			);
			expect(commentsImport).toBeTruthy();
		});

		it("inserts imports after zod import when present", () => {
			const collectionTypes = createEmptyCollectionTypesMap(["users", "posts"]);
			const baseInterfaceNaming = { prefix: "", suffix: "Base" };
			const baseTypeIndex = createBaseTypeIndex(
				collectionTypes,
				baseInterfaceNaming,
			);
			const content = `import { z } from "z";\nexport interface UsersRelations {\n\tposts?: PostsBase[];\n}`;

			const withImports = withMainFileImports(
				content,
				createEmptyCollectionTypesMap(["users"]),
				new Set(["posts"]),
				baseTypeIndex,
				baseInterfaceNaming,
			);

			expect(withImports).toContain('import { z } from "z";');
			expect(withImports).toContain(
				'import type { PostsBase } from "./posts";',
			);
			expect(withImports.indexOf("import type")).toBeGreaterThan(
				withImports.indexOf('from "z"'),
			);
		});

		it("skips references to collections that are not split", () => {
			const collectionTypes = createEmptyCollectionTypesMap(["users", "posts"]);
			const baseInterfaceNaming = { prefix: "", suffix: "Base" };
			const baseTypeIndex = createBaseTypeIndex(
				collectionTypes,
				baseInterfaceNaming,
			);
			const content = `export interface UsersRelations {\n\tposts?: PostsBase[];\n}`;

			const withImports = withMainFileImports(
				content,
				createEmptyCollectionTypesMap(["users"]),
				new Set(["comments"]),
				baseTypeIndex,
				baseInterfaceNaming,
			);

			expect(withImports).toBe(content);
		});

		it("inserts imports after zod import at end of file without trailing newline", () => {
			const content = 'import { z } from "z"';

			const withImports = injectTypeImports(
				content,
				new Map([["./posts", new Set(["PostsBase"])]]),
			);

			expect(withImports).toContain('import { z } from "z"');
			expect(withImports).toContain(
				'import type { PostsBase } from "./posts";',
			);
		});

		it("sorts multiple type names alphabetically within the same source", () => {
			const content = "/**\n * generated\n */\n\nexport interface UsersBase { id: number; }";

			const withImports = injectTypeImports(
				content,
				new Map([
					["./shared", new Set(["ZebraBase", "AlphaBase", "MangoBase"])],
				]),
			);

			const zebraIndex = withImports.indexOf("ZebraBase");
			const alphaIndex = withImports.indexOf("AlphaBase");
			const mangoIndex = withImports.indexOf("MangoBase");

			expect(alphaIndex).toBeGreaterThan(-1);
			expect(mangoIndex).toBeGreaterThan(alphaIndex);
			expect(zebraIndex).toBeGreaterThan(mangoIndex);
		});

		it("returns content unchanged when injectTypeImports receives empty map", () => {
			const content = "export interface UsersBase { id: number; }";

			expect(injectTypeImports(content, new Map())).toBe(content);
		});

		it("ignores type names that appear only inside string literals", () => {
			const collectionTypes = createEmptyCollectionTypesMap(["users", "posts"]);
			const baseInterfaceNaming = { prefix: "", suffix: "Base" };
			const baseTypeIndex = createBaseTypeIndex(
				collectionTypes,
				baseInterfaceNaming,
			);
			const content = `export const label = "PostsBase reference";\nexport interface UsersBase { id: number; }`;

			const withImports = withMainFileImports(
				content,
				createEmptyCollectionTypesMap(["users"]),
				new Set(["posts"]),
				baseTypeIndex,
				baseInterfaceNaming,
			);

			expect(withImports).toBe(content);
		});

		it("ignores type names inside double-quoted and template literals", () => {
			const collectionTypes = createEmptyCollectionTypesMap(["users", "posts"]);
			const baseInterfaceNaming = { prefix: "", suffix: "Base" };
			const baseTypeIndex = createBaseTypeIndex(
				collectionTypes,
				baseInterfaceNaming,
			);
			const content = [
				'export const a = "PostsBase";',
				"export const b = `PostsBase`;",
				"export interface UsersBase { id: number; }",
			].join("\n");

			const withImports = withMainFileImports(
				content,
				createEmptyCollectionTypesMap(["users"]),
				new Set(["posts"]),
				baseTypeIndex,
				baseInterfaceNaming,
			);

			expect(withImports).toBe(content);
		});
	});

	describe("mergeImportBySource", () => {
		it("merges multiple type names into the same source import", () => {
			const importsBySource = new Map<string, Set<string>>();

			mergeImportBySource(importsBySource, "./shared", "PostsBase");
			mergeImportBySource(importsBySource, "./shared", "CommentsBase");

			expect(importsBySource.get("./shared")).toEqual(
				new Set(["PostsBase", "CommentsBase"]),
			);
		});
	});

	describe("addImport (via integration tests)", () => {
		it("handles duplicate imports from same source", () => {
			const collectionTypes = createEmptyCollectionTypesMap(["users", "posts"]);
			const baseInterfaceNaming = { prefix: "", suffix: "Base" };
			const baseTypeIndex = createBaseTypeIndex(
				collectionTypes,
				baseInterfaceNaming,
			);
			const content = `export interface UsersRelations {\n\tposts1?: PostsBase[];\n\tposts2?: PostsBase[];\n}`;

			const withImports = withMainFileImports(
				content,
				createEmptyCollectionTypesMap(["users"]),
				new Set(["posts"]),
				baseTypeIndex,
				baseInterfaceNaming,
			);

			const importMatches = withImports.match(
				/import type \{ PostsBase \} from "\.\/posts";/g,
			);
			expect(importMatches).toHaveLength(1);
		});
	});
});
