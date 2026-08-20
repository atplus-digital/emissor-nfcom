import type { EnumOption, RelationInfo } from "../@types/generation";
import type { DataSourceField } from "../@types/script";
import {
	inferRelationFromFieldName,
	resolveRelationByType,
	resolveRelationInterface,
} from "./relations";

/**
 * Mapeamento de tipos escalares para TypeScript.
 *
 * IMPORTANTE: não há injeção global de campos. O gerador tipa apenas
 * os campos retornados pela fonte de dados.
 */
const FIELD_TYPE_MAP: Record<string, string> = {
	array: "string[]",
	boolean: "boolean",
	context: "unknown",
	date: "string",
	dateOnly: "string",
	datetime: "string",
	month: "string",
	time: "string",
	year: "string",
	bigInt: "number",
	decimal: "number",
	double: "number",
	float: "number",
	integer: "number",
	sort: "number",
	timestamp: "number",
	json: "Record<string, unknown>",
	jsonb: "Record<string, unknown>",
	object: "Record<string, unknown>",
	set: "unknown[]",
	email: "string",
	formula: "string",
	ipv4: "string",
	ipv6: "string",
	lineString: "string",
	movedTo: "string",
	nanoid: "string",
	password: "string",
	phone: "string",
	point: "string",
	sequence: "string",
	snowflakeId: "number",
	string: "string",
	text: "string",
	uid: "string",
	url: "string",
};

export function extractRelationInfo(
	field: DataSourceField,
	manualRelations?: Record<
		string,
		{ target: string; type: "belongsTo" | "hasMany" | "m2m" | "hasOne" }
	>,
	inferRelationsByName = false,
): RelationInfo | null {
	if (manualRelations?.[field.name]) {
		const manual = manualRelations[field.name];
		if (!manual) {
			return null;
		}
		return { type: manual.type, targetCollection: manual.target };
	}

	let relationType = resolveRelationInterface(field.interface);
	if (!relationType) {
		relationType = resolveRelationByType(field.type);
	}

	if (relationType) {
		return { type: relationType, targetCollection: field.target ?? "" };
	}

	if (inferRelationsByName) {
		return inferRelationFromFieldName(field.name);
	}

	return null;
}

function extractEnumValues(
	enumOptions: EnumOption[] | undefined,
): Array<string | number> {
	if (!enumOptions || enumOptions.length === 0) return [];
	return Array.from(new Set(enumOptions.map((opt) => opt.value)));
}

function buildEnumType(enumOptions: EnumOption[]): string {
	const values = extractEnumValues(enumOptions);
	if (values.length === 0) return "string";
	return values
		.map((v) => (typeof v === "string" ? `"${v}"` : String(v)))
		.join(" | ");
}

export function mapFieldType(field: DataSourceField): string {
	if (field.uiSchema?.enum && field.uiSchema.enum.length > 0) {
		return buildEnumType(field.uiSchema.enum);
	}

	if (field.interface === "context" || field.type === "context") {
		return "unknown";
	}

	if (field.interface === "set") {
		return "unknown[]";
	}

	const tsType = FIELD_TYPE_MAP[field.type];
	if (!tsType) {
		return "unknown";
	}
	return tsType;
}
