import type { EnumOption } from "@generators/pipelines/generate-types/@types/generation";
import { generateCollectionEnumTypes } from "@generators/pipelines/generate-types/content/enums";
import { describe, expect, it } from "vitest";

function typesWithEnum(fieldName: string, enumOptions: EnumOption[]) {
	return {
		scalars: new Map<string, string>(),
		relations: new Map(),
		enums: new Map([[fieldName, enumOptions]]),
		fieldLabels: new Map<string, string>(),
		tableLabel: "test",
		schemaAvailable: true as const,
	};
}

describe("generateCollectionEnumTypes", () => {
	it("deve gerar type alias com nome correto para valores com acentos", () => {
		const enumOptions: EnumOption[] = [
			{ value: "União Estável", label: "União Estável" },
			{ value: "Viúvo", label: "Viúvo" },
			{ value: "Solteiro", label: "Solteiro" },
		];

		const result = generateCollectionEnumTypes(
			"t_teste",
			typesWithEnum("status", enumOptions),
		);

		expect(result).toBe(
			"export type TesteStatus = z.infer<typeof testeStatusSchema>;",
		);
	});

	it("deve gerar type alias com nome correto para valores numéricos", () => {
		const enumOptions: EnumOption[] = [
			{ value: "3", label: "Ruim" },
			{ value: "4", label: "Regular" },
			{ value: "5", label: "Bom" },
		];

		const result = generateCollectionEnumTypes(
			"t_teste",
			typesWithEnum("grau_satisfacao", enumOptions),
		);

		expect(result).toBe(
			"export type TesteGrauSatisfacao = z.infer<typeof testeGrauSatisfacaoSchema>;",
		);
	});

	it("deve gerar type alias com nome correto para valores com espaços", () => {
		const enumOptions: EnumOption[] = [
			{ value: "Pessoa Física", label: "Pessoa Física" },
			{ value: "Pessoa Jurídica", label: "Pessoa Jurídica" },
			{ value: "Outros", label: "Outros" },
		];

		const result = generateCollectionEnumTypes(
			"t_teste",
			typesWithEnum("tipo", enumOptions),
		);

		expect(result).toBe(
			"export type TesteTipo = z.infer<typeof testeTipoSchema>;",
		);
	});
});
