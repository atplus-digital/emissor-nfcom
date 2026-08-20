import { describe, expect, it } from "bun:test";
import type { DataSourceField } from "@pipelines/generate-types/@types/script-data-source";
import { mapFieldType } from "@pipelines/generate-types/content/field-mapper";

describe("mapFieldType - Enum Extraction", () => {
	it("should generate union type from uiSchema.enum for select field", () => {
		const field: DataSourceField = {
			name: "status",
			type: "string",
			interface: "select",
			uiSchema: {
				enum: [
					{ value: "ativo", label: "Ativo" },
					{ value: "inativo", label: "Inativo" },
					{ value: "pendente", label: "Pendente" },
				],
			},
		};

		const result = mapFieldType(field);
		expect(result).toBe('"ativo" | "inativo" | "pendente"');
	});

	it("should handle radioGroup with enum values", () => {
		const field: DataSourceField = {
			name: "tipo_pessoa",
			type: "string",
			interface: "radioGroup",
			uiSchema: {
				enum: [
					{ value: "pf", label: "Pessoa Física" },
					{ value: "pj", label: "Pessoa Jurídica" },
				],
			},
		};

		const result = mapFieldType(field);
		expect(result).toBe('"pf" | "pj"');
	});

	it("should handle checkboxGroup with multiple values", () => {
		const field: DataSourceField = {
			name: "tags",
			type: "array",
			interface: "checkboxGroup",
			uiSchema: {
				enum: [
					{ value: "urgente", label: "Urgente" },
					{ value: "vip", label: "VIP" },
					{ value: "novo", label: "Novo" },
				],
			},
		};

		const result = mapFieldType(field);
		expect(result).toBe('"urgente" | "vip" | "novo"');
	});

	it("should remove duplicate enum values", () => {
		const field: DataSourceField = {
			name: "status",
			type: "string",
			interface: "select",
			uiSchema: {
				enum: [
					{ value: "ativo", label: "Ativo" },
					{ value: "inativo", label: "Inativo" },
					{ value: "ativo", label: "Ativo (duplicate)" },
				],
			},
		};

		const result = mapFieldType(field);
		expect(result).toBe('"ativo" | "inativo"');
	});

	it("should handle integer enum values", () => {
		const field: DataSourceField = {
			name: "prioridade",
			type: "integer",
			interface: "select",
			uiSchema: {
				enum: [
					{ value: 1, label: "Baixa" },
					{ value: 2, label: "Média" },
					{ value: 3, label: "Alta" },
				],
			},
		};

		const result = mapFieldType(field);
		expect(result).toBe("1 | 2 | 3");
	});

	it("should fallback to field type when uiSchema.enum is empty", () => {
		const field: DataSourceField = {
			name: "descricao",
			type: "string",
			interface: "select",
			uiSchema: {
				enum: [],
			},
		};

		const result = mapFieldType(field);
		expect(result).toBe("string");
	});

	it("should fallback to field type when uiSchema is undefined", () => {
		const field: DataSourceField = {
			name: "nome",
			type: "string",
			interface: "input",
		};

		const result = mapFieldType(field);
		expect(result).toBe("string");
	});

	it("should handle boolean type without enum", () => {
		const field: DataSourceField = {
			name: "ativo",
			type: "boolean",
			interface: "checkbox",
		};

		const result = mapFieldType(field);
		expect(result).toBe("boolean");
	});

	it("should handle mixed string and number enum values", () => {
		const field: DataSourceField = {
			name: "status",
			type: "string",
			interface: "select",
			uiSchema: {
				enum: [
					{ value: "aberto", label: "Aberto" },
					{ value: 0, label: "Zero" },
					{ value: "fechado", label: "Fechado" },
					{ value: 1, label: "Um" },
				],
			},
		};

		const result = mapFieldType(field);
		expect(result).toBe('"aberto" | 0 | "fechado" | 1');
	});
});
