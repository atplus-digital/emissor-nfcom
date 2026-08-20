import { jsonToSingleQuotedString } from "@generators/utils/strings";
import type {
	EnumOption,
	GeneratedTypes,
} from "@pipelines/generate-types/@types/generation";
import {
	removeAccents,
	stripTablePrefix,
	stripTechnicalPrefix,
	toCollectionConstantPrefix,
	toCollectionTypeName,
	toScreamingSnakeCase,
	toValidIdentifier,
} from "@pipelines/generate-types/utils/naming";

interface EnumFieldInfo {
	/** Nome do campo no formato PascalCase */
	fieldName: string;
	/** Nome do schema Zod em camelCase */
	schemaName: string;
	/** Nome do type inferido do schema */
	typeName: string;
	/** Nome da constante de labels em SCREAMING_SNAKE_CASE */
	labelsName: string;
}

/**
 * Converte valor de enum em nome válido para TypeScript enum member.
 * Regras: deve começar com letra/underline, conter apenas letras, números e underline.
 */
export function toEnumMemberName(value: string | number): string {
	const raw = value.toString();
	const withoutAccents = removeAccents(raw);
	const sanitized = withoutAccents
		.replace(/[^a-zA-Z0-9]/g, "_")
		.replace(/_+/g, "_")
		.replace(/^_|_$/g, "");

	const parts = sanitized.split("_").filter((part) => part.length > 0);

	if (parts.length === 0) {
		return "UNKNOWN";
	}

	const pascal = parts
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
		.join("");

	if (/^\d/.test(pascal) || pascal.length === 0) {
		return `Value${pascal || "Unknown"}`;
	}

	return pascal;
}

/**
 * Verifica se uma string pode ser usada como key de objeto sem quotes.
 * Para keys de objeto TypeScript, strings numéricas puras são válidas.
 * Regras: letras/números/underscore, OU apenas números (sem leading zeros).
 */
function isValidObjectKey(str: string): boolean {
	// Strings numéricas puras SEM leading zeros são válidas
	if (/^[1-9]\d*$|^0$/.test(str)) {
		return true;
	}
	// Identifiers TypeScript tradicionais
	return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(str);
}

/**
 * Deriva o nome da variável em camelCase a partir do nome do campo.
 * Ex: t_pessoas + f_status → pessoasStatusSchema
 * Ex: t_902ctke5dhq + f_status → _902ctke5dhqStatusSchema
 */
export function toEnumSchemaName(
	collectionName: string,
	fieldName: string,
): string {
	// Remove t_ or f_ prefix from collection name
	const cleanCollectionName = stripTablePrefix(collectionName);
	// Remove t_ or f_ prefix from field name
	const fieldNameWithoutPrefix = stripTechnicalPrefix(fieldName);
	// Converte f_status → status → _902ctke5dhqStatusSchema
	const pascalField = toEnumMemberName(fieldNameWithoutPrefix);
	return toValidIdentifier(
		`${cleanCollectionName.toLowerCase()}${pascalField}Schema`,
	);
}

/**
 * Deriva o nome do type em PascalCase.
 * Ex: f_status → PessoasStatus
 */
function toEnumTypeName(collectionName: string, fieldName: string): string {
	const fieldNameWithoutPrefix = stripTechnicalPrefix(fieldName);
	return `${toCollectionTypeName(collectionName)}${toEnumMemberName(fieldNameWithoutPrefix)}`;
}

/**
 * Extrai as informações de um campo enum.
 */
function getEnumFieldInfo(
	collectionName: string,
	fieldName: string,
	_enumOptions: EnumOption[],
): EnumFieldInfo {
	const fieldNameWithoutPrefix = stripTechnicalPrefix(fieldName);
	const labelsName = `${toCollectionConstantPrefix(collectionName)}_${toScreamingSnakeCase(fieldNameWithoutPrefix)}_LABELS`;

	return {
		fieldName: fieldNameWithoutPrefix,
		schemaName: toEnumSchemaName(collectionName, fieldName),
		typeName: toEnumTypeName(collectionName, fieldName),
		labelsName,
	};
}

/**
 * Gera o objeto constante de labels com as const.
 * Single source of truth para os valores de enum.
 * Ex: export const PESSOAS_SEXO_LABELS = { M: "MASCULINO", F: "FEMININO" } as const;
 */
function generateEnumLabelMap(
	collectionName: string,
	fieldName: string,
	enumOptions: EnumOption[],
): string {
	const { labelsName } = getEnumFieldInfo(
		collectionName,
		fieldName,
		enumOptions,
	);
	const seenValues = new Set<string | number>();
	const seenMemberNames = new Set<string>();
	const dedupedOptions = enumOptions
		.filter((opt) => {
			if (seenValues.has(opt.value)) {
				return false;
			}
			seenValues.add(opt.value);
			return true;
		})
		.filter((opt) => {
			const valueStr = String(opt.value);
			const needsTransformation = !isValidObjectKey(valueStr);
			const memberName = needsTransformation
				? toEnumMemberName(opt.value)
				: valueStr;

			if (seenMemberNames.has(memberName)) {
				return false;
			}
			seenMemberNames.add(memberName);
			return true;
		});

	const entries = dedupedOptions
		.map((opt) => {
			const valueStr = String(opt.value);
			// Use jsonToSingleQuotedString to properly escape for single-quoted TS strings
			const label = `'${jsonToSingleQuotedString(JSON.stringify(opt.label))}'`;
			// Keys must ALWAYS be the original enum values for correct lookup
			const keyName = isValidObjectKey(valueStr) ? valueStr : `"${valueStr}"`;

			return `\t${keyName}: ${label}`;
		})
		.join(",\n");

	return `export const ${labelsName} = {\n${entries}\n} as const;`;
}

/**
 * Escapa um valor de enum para uso seguro em string TypeScript double-quoted.
 * Lida com aspas, backslashes e outros caracteres especiais.
 */
function escapeEnumValue(value: string): string {
	return value
		.replace(/\\/g, "\\\\")
		.replace(/"/g, '\\"')
		.replace(/\n/g, "\\n")
		.replace(/\r/g, "\\r")
		.replace(/\t/g, "\\t");
}

/**
 * Escapa uma label para uso em mensagem de erro (double-quoted string).
 * - Escapa backslashes, aspas duplas, newlines, tabs
 * - Escapa vírgulas com backslash para não quebrar a lista entre colchetes
 */
function escapeLabelForMessage(label: string): string {
	// Primeiro JSON.stringify para escapar caracteres especiais
	const jsonEscaped = JSON.stringify(label);
	// Remove aspas externas do JSON e substitui vírgulas
	const inner = jsonEscaped.slice(1, -1);
	// Escapa vírgulas para não quebrar a lista
	return inner.replace(/,/g, "\\,");
}

/**
 * Gera o schema Zod para um campo enum.
 * Extrai valores das labels e adiciona mensagem de erro customizada.
 * Usa labels no message de erro para melhor UX.
 * Ex: export const pessoasSexoSchema = z.enum(["M", "F"], { error: ... });
 */
function generateEnumSchema(
	collectionName: string,
	fieldName: string,
	enumOptions: EnumOption[],
): string {
	const { schemaName, fieldName: fieldNameWithoutPrefix } = getEnumFieldInfo(
		collectionName,
		fieldName,
		enumOptions,
	);
	const seenValues = new Set<string | number>();

	// Extrair valores e labels únicos preservando ordem
	const uniqueEntries: { value: string; label: string }[] = [];
	for (const opt of enumOptions) {
		if (seenValues.has(opt.value)) continue;

		seenValues.add(opt.value);
		uniqueEntries.push({ value: String(opt.value), label: opt.label });
	}

	const valuesList = uniqueEntries
		.map((e) => `"${escapeEnumValue(e.value)}"`)
		.join(", ");
	// Para a mensagem de erro, escapamos vírgulas dentro das labels
	// para não quebrar a lista entre colchetes
	const validLabels = uniqueEntries
		.map((e) => escapeLabelForMessage(e.label))
		.join(", ");

	return `export const ${schemaName} = z.enum([${valuesList}], {
  error: () => ({ message: "${fieldNameWithoutPrefix}: valores válidos são [${validLabels}]" }),
});`;
}

/**
 * Gera o type alias para um campo enum, inferido do schema Zod.
 * Ex: export type PessoasSexo = z.infer<typeof pessoasSexoSchema>;
 */
function generateEnumType(
	collectionName: string,
	fieldName: string,
	_enumOptions: EnumOption[],
): string {
	const { schemaName, typeName } = getEnumFieldInfo(
		collectionName,
		fieldName,
		_enumOptions,
	);
	return `export type ${typeName} = z.infer<typeof ${schemaName}>;`;
}

/**
 * Itera os enums da collection ordenados por nome de campo.
 */
function forSortedEnums(
	types: GeneratedTypes,
	render: (fieldName: string, enumOptions: EnumOption[]) => string,
): string[] {
	return Array.from(types.enums.entries())
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([fieldName, enumOptions]) => render(fieldName, enumOptions));
}

/**
 * Gera todos os mapas de labels de enums de uma collection.
 * Seguindo a ordem: Labels primeiro (single source of truth).
 */
export function generateCollectionEnumMaps(
	collectionName: string,
	types: GeneratedTypes,
): string {
	if (types.enums.size === 0) {
		return "";
	}

	return forSortedEnums(types, (fieldName, enumOptions) =>
		generateEnumLabelMap(collectionName, fieldName, enumOptions),
	).join("\n\n");
}

/**
 * Gera todos os schemas Zod de enums de uma collection.
 */
export function generateCollectionEnumSchemas(
	collectionName: string,
	types: GeneratedTypes,
): string {
	if (types.enums.size === 0) {
		return "";
	}

	return forSortedEnums(types, (fieldName, enumOptions) =>
		generateEnumSchema(collectionName, fieldName, enumOptions),
	).join("\n\n");
}

/**
 * Gera todos os types de enums de uma collection.
 */
export function generateCollectionEnumTypes(
	collectionName: string,
	types: GeneratedTypes,
): string {
	if (types.enums.size === 0) {
		return "";
	}

	return forSortedEnums(types, (fieldName, enumOptions) =>
		generateEnumType(collectionName, fieldName, enumOptions),
	).join("\n\n");
}

/**
 * Mapa field → labels de enum para uso runtime (analytics, filtros).
 */
export function generateEnumLabelsByFieldMap(
	collectionName: string,
	types: GeneratedTypes,
): string {
	if (types.enums.size === 0) {
		return "export const ENUM_LABELS_BY_FIELD = {} as const;";
	}

	const entries = forSortedEnums(types, (fieldName, enumOptions) => {
		const { labelsName } = getEnumFieldInfo(
			collectionName,
			fieldName,
			enumOptions,
		);
		return `\t${JSON.stringify(fieldName)}: ${labelsName},`;
	});

	return `export const ENUM_LABELS_BY_FIELD = {\n${entries.join("\n")}\n} as const;`;
}

/**
 * Gera o tipo para um campo escalar, usando enum se disponível.
 * Retorna o type alias inferido do enum quando existir, ou o tipo escalar.
 */
export function getScalarFieldType(
	fieldName: string,
	fieldType: string,
	types: GeneratedTypes,
	collectionName: string,
): string {
	if (types.enums.has(fieldName)) {
		const { typeName } = getEnumFieldInfo(
			collectionName,
			fieldName,
			// biome-ignore lint/style/noNonNullAssertion: garante que o enumOptions existe para esse fieldName
			types.enums.get(fieldName)!,
		);
		return typeName;
	}

	return fieldType;
}

/**
 * Gera o tipo Zod para um campo escalar (para uso no schema principal).
 */
export function getScalarFieldZodType(
	fieldName: string,
	fieldType: string,
	types: GeneratedTypes,
	collectionName: string,
): string {
	if (types.enums.has(fieldName)) {
		const { schemaName } = getEnumFieldInfo(
			collectionName,
			fieldName,
			// biome-ignore lint/style/noNonNullAssertion: garante que o enumOptions existe para esse fieldName
			types.enums.get(fieldName)!,
		);
		return schemaName;
	}

	// Mapear tipos escalares para schemas Zod
	const scalarToZod: Record<string, string> = {
		string: "z.string()",
		number: "z.number()",
		boolean: "z.boolean()",
		Date: "z.string()", // NocoBase usa string para datas
	};

	return scalarToZod[fieldType] ?? "z.string()";
}
