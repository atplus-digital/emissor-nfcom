import { describe, expect, it } from "bun:test";
import type { GeneratedTypes } from "@pipelines/generate-types/@types/generation";
import {
	generateCollectionEnumMaps,
	generateCollectionEnumSchemas,
	generateCollectionEnumTypes,
	getScalarFieldType,
	getScalarFieldZodType,
	toEnumMemberName,
} from "@pipelines/generate-types/content/enums";

function emptyGeneratedTypes(
	enums: GeneratedTypes["enums"] = new Map(),
): GeneratedTypes {
	return {
		scalars: new Map(),
		relations: new Map(),
		enums,
		fieldLabels: new Map(),
		tableLabel: "test",
		schemaAvailable: true,
	};
}

describe("toEnumMemberName", () => {
	it("sanitizes accented values", () => {
		expect(toEnumMemberName("União Estável")).toBe("UniaoEstavel");
	});

	it("prefixes numeric-leading values", () => {
		expect(toEnumMemberName("123")).toBe("Value123");
	});

	it("returns UNKNOWN for empty sanitized values", () => {
		expect(toEnumMemberName("!!!")).toBe("UNKNOWN");
	});
});

describe("generateCollectionEnumMaps", () => {
	it("should generate all constant objects for a collection", () => {
		const types = emptyGeneratedTypes(
			new Map([
				[
					"f_status",
					[
						{ value: "ativo", label: "Ativo" },
						{ value: "inativo", label: "Inativo" },
					],
				],
				[
					"f_tipo_pessoa",
					[
						{ value: "pf", label: "Pessoa Física" },
						{ value: "pj", label: "Pessoa Jurídica" },
					],
				],
			]),
		);

		const result = generateCollectionEnumMaps("t_pessoas", types);

		expect(result).toContain("export const PESSOAS_STATUS_LABELS = {");
		expect(result).toContain("export const PESSOAS_TIPO_PESSOA_LABELS = {");
		expect(result).toContain("} as const;");
	});

	it("should return empty string when no enums", () => {
		const types: GeneratedTypes = {
			scalars: new Map([["id", "number"]]),
			relations: new Map(),
			enums: new Map(),
			fieldLabels: new Map(),
			tableLabel: "test",
			schemaAvailable: true,
		};

		expect(generateCollectionEnumMaps("t_pessoas", types)).toBe("");
	});

	it("uses option labels from schema without manual fallback", () => {
		const types = emptyGeneratedTypes(
			new Map([
				[
					"tipo_pessoa",
					[
						{ value: "F", label: "F" },
						{ value: "J", label: "J" },
					],
				],
			]),
		);

		const result = generateCollectionEnumMaps("cliente", types);

		expect(result).toContain("F: 'F'");
		expect(result).toContain("J: 'J'");
	});

	it("should sort enum maps alphabetically by field name", () => {
		const types = emptyGeneratedTypes(
			new Map([
				["zebra", [{ value: "z", label: "Z" }]],
				["alfa", [{ value: "a", label: "A" }]],
				["beta", [{ value: "b", label: "B" }]],
			]),
		);

		const result = generateCollectionEnumMaps("t_teste", types);
		const alfaIndex = result.indexOf("TESTE_ALFA_LABELS");
		const betaIndex = result.indexOf("TESTE_BETA_LABELS");
		const zebraIndex = result.indexOf("TESTE_ZEBRA_LABELS");

		expect(alfaIndex).toBeLessThan(betaIndex);
		expect(betaIndex).toBeLessThan(zebraIndex);
	});

	it("deduplicates enum values and member names", () => {
		const types = emptyGeneratedTypes(
			new Map([
				[
					"f_status",
					[
						{ value: "a", label: "A" },
						{ value: "a", label: "Duplicate" },
						{ value: "a-b", label: "Dash" },
						{ value: "a_b", label: "Underscore" },
					],
				],
			]),
		);

		const maps = generateCollectionEnumMaps("t_users", types);
		const schemas = generateCollectionEnumSchemas("t_users", types);

		expect(maps.match(/\ba:/g)?.length).toBe(1);
		expect(maps).not.toContain("Duplicate");
		expect(schemas).toContain('"a-b"');
		expect(schemas).toContain("valores válidos");
	});

	it("quotes enum keys with special characters and escapes labels", () => {
		const types = emptyGeneratedTypes(
			new Map([
				[
					"f_code",
					[
						{ value: "01", label: "Leading zero" },
						{ value: "a,b", label: 'Label, with "comma"' },
					],
				],
			]),
		);

		const result = generateCollectionEnumMaps("users", types);

		expect(result).toContain('"01"');
		expect(result).toContain('"a,b"');
		expect(result).toContain('Label, with "comma"');
	});

	it("uses unquoted numeric enum keys when valid", () => {
		const types = emptyGeneratedTypes(
			new Map([
				[
					"f_level",
					[
						{ value: 0, label: "Zero" },
						{ value: 5, label: "Five" },
					],
				],
			]),
		);

		const result = generateCollectionEnumMaps("users", types);

		expect(result).toContain("\t0: 'Zero'");
		expect(result).toContain("\t5: 'Five'");
	});

	it("keeps generic labels from schema as-is", () => {
		const types = emptyGeneratedTypes(
			new Map([["f_status", [{ value: "x", label: "x" }]]]),
		);

		const result = generateCollectionEnumMaps("unknown_collection", types);

		expect(result).toContain("x: 'x'");
	});

	it("deduplicates transformed member names in label maps", () => {
		const types = emptyGeneratedTypes(
			new Map([
				[
					"f_status",
					[
						{ value: "a-b", label: "Dash" },
						{ value: "a_b", label: "Underscore" },
					],
				],
			]),
		);

		const result = generateCollectionEnumMaps("users", types);

		expect(result).toContain('"a-b"');
		expect(result).not.toContain('"a_b"');
	});

	it("generates schema names for numeric-prefixed collections", () => {
		const types = emptyGeneratedTypes(
			new Map([["f_status", [{ value: "a", label: "A" }]]]),
		);

		const result = generateCollectionEnumSchemas("t_902ctke5dhq", types);

		expect(result).toContain("export const _902ctke5dhqStatusSchema = z.enum(");
	});

	it("escapes special characters in enum schema values and labels", () => {
		const types = emptyGeneratedTypes(
			new Map([
				[
					"f_note",
					[
						{
							value: 'quote"slash\\',
							label: "Label, with comma",
						},
					],
				],
			]),
		);

		const result = generateCollectionEnumSchemas("users", types);

		expect(result).toContain('\\"');
		expect(result).toContain("\\\\");
		expect(result).toContain("Label\\, with comma");
	});
});

describe("generateCollectionEnumSchemas", () => {
	it("should generate all Zod schemas for a collection", () => {
		const types = emptyGeneratedTypes(
			new Map([
				[
					"f_status",
					[
						{ value: "ativo", label: "Ativo" },
						{ value: "inativo", label: "Inativo" },
					],
				],
				[
					"f_tipo_pessoa",
					[
						{ value: "pf", label: "Pessoa Física" },
						{ value: "pj", label: "Pessoa Jurídica" },
					],
				],
			]),
		);

		const result = generateCollectionEnumSchemas("t_pessoas", types);

		expect(result).toContain("export const pessoasStatusSchema = z.enum(");
		expect(result).toContain("export const pessoasTipoPessoaSchema = z.enum(");
	});

	it("should return empty string when no enums", () => {
		const types: GeneratedTypes = {
			scalars: new Map([["id", "number"]]),
			relations: new Map(),
			enums: new Map(),
			fieldLabels: new Map(),
			tableLabel: "test",
			schemaAvailable: true,
		};

		expect(generateCollectionEnumSchemas("t_pessoas", types)).toBe("");
	});
});

describe("getScalarFieldType", () => {
	it("returns enum type name when field has enum", () => {
		const types = emptyGeneratedTypes(
			new Map([["f_status", [{ value: "a", label: "A" }]]]),
		);

		expect(getScalarFieldType("f_status", "string", types, "t_users")).toBe(
			"UsersStatus",
		);
	});

	it("returns scalar type when field has no enum", () => {
		const types = emptyGeneratedTypes();

		expect(getScalarFieldType("id", "number", types, "users")).toBe("number");
	});
});

describe("getScalarFieldZodType", () => {
	it("returns enum schema name when field has enum", () => {
		const types = emptyGeneratedTypes(
			new Map([["f_status", [{ value: "a", label: "A" }]]]),
		);

		expect(getScalarFieldZodType("f_status", "string", types, "t_users")).toBe(
			"usersStatusSchema",
		);
	});

	it("maps scalar types to zod helpers and falls back to string", () => {
		const types = emptyGeneratedTypes();

		expect(getScalarFieldZodType("id", "number", types, "users")).toBe(
			"z.number()",
		);
		expect(getScalarFieldZodType("active", "boolean", types, "users")).toBe(
			"z.boolean()",
		);
		expect(getScalarFieldZodType("createdAt", "Date", types, "users")).toBe(
			"z.string()",
		);
		expect(getScalarFieldZodType("unknown", "custom", types, "users")).toBe(
			"z.string()",
		);
	});
});

describe("generateCollectionEnumTypes", () => {
	it("should generate all type aliases for a collection", () => {
		const types = emptyGeneratedTypes(
			new Map([
				[
					"f_status",
					[
						{ value: "ativo", label: "Ativo" },
						{ value: "inativo", label: "Inativo" },
					],
				],
				[
					"f_tipo_pessoa",
					[
						{ value: "pf", label: "Pessoa Física" },
						{ value: "pj", label: "Pessoa Jurídica" },
					],
				],
			]),
		);

		const result = generateCollectionEnumTypes("t_pessoas", types);

		expect(result).toContain(
			"export type PessoasStatus = z.infer<typeof pessoasStatusSchema>;",
		);
		expect(result).toContain(
			"export type PessoasTipoPessoa = z.infer<typeof pessoasTipoPessoaSchema>;",
		);
	});

	it("should return empty string when no enums", () => {
		const types: GeneratedTypes = {
			scalars: new Map([["id", "number"]]),
			relations: new Map(),
			enums: new Map(),
			fieldLabels: new Map(),
			tableLabel: "test",
			schemaAvailable: true,
		};

		expect(generateCollectionEnumTypes("t_pessoas", types)).toBe("");
	});
});
