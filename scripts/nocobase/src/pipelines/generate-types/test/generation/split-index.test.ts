import { generateIndexWithAllExportsWithPaths } from "@generators/pipelines/generate-types/content/split-index";
import { describe, expect, it } from "vitest";

const baseNaming = { prefix: "", suffix: "Base" };

describe("generateIndexWithAllExportsWithPaths", () => {
	it("re-exports base type names from custom paths", () => {
		const paths = new Map([
			["t_empresas", "./empresas"],
			["users", "./users"],
		]);
		const content = generateIndexWithAllExportsWithPaths(
			["t_empresas", "users"],
			paths,
			baseNaming,
		);

		expect(content).toContain(
			'export type { EmpresasBase, EmpresasRelations, EmpresasRelationKey } from "./empresas";',
		);
		expect(content).toContain(
			'export type { UsersBase, UsersRelations, UsersRelationKey } from "./users";',
		);
	});

	it("returns only header when collection list is empty", () => {
		const content = generateIndexWithAllExportsWithPaths(
			[],
			new Map(),
			baseNaming,
		);

		expect(content).toMatchInlineSnapshot(`
      "/**
       * Arquivo gerado automaticamente
       * NÃO EDITAR MANUALMENTE - usar: pnpm generate-types
       * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
       */
      "
    `);
		expect(content).not.toContain("export type");
	});

	it("sorts exports alphabetically", () => {
		const content = generateIndexWithAllExportsWithPaths(
			["zebra", "alpha", "middle"],
			new Map(),
			baseNaming,
		);

		const alphaIndex = content.indexOf("AlphaBase");
		const middleIndex = content.indexOf("MiddleBase");
		const zebraIndex = content.indexOf("ZebraBase");

		expect(alphaIndex).toBeLessThan(middleIndex);
		expect(middleIndex).toBeLessThan(zebraIndex);
	});

	it("defaults import path to kebab-case file name", () => {
		const content = generateIndexWithAllExportsWithPaths(
			["t_user_roles"],
			new Map(),
			baseNaming,
		);

		expect(content).toContain('from "./user-roles"');
	});

	it("includes file header", () => {
		const content = generateIndexWithAllExportsWithPaths(
			["t_users"],
			new Map(),
			baseNaming,
		);

		expect(content).toContain("Arquivo gerado automaticamente");
		expect(content).toContain("pnpm generate-types");
	});
});
