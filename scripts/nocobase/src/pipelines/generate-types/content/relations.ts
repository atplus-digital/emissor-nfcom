import type {
	RelationCardinality,
	RelationInfo,
	RelationInterface,
} from "@generators/pipelines/generate-types/@types/generation";
import type { BaseInterfaceNamingConfig } from "@generators/pipelines/generate-types/@types/script";
import {
	toBaseSchemaName,
	toCollectionBaseTypeName,
} from "@generators/pipelines/generate-types/utils/naming";

// ============================================================
// Relation interface resolution
// ============================================================

const RELATION_INTERFACE_MAP: Record<string, RelationInterface> = {
	m2o: "m2o",
	belongsto: "belongsTo",
	createdby: "belongsTo",
	o2m: "o2m",
	hasmany: "hasMany",
	m2m: "m2m",
	manytomany: "manyToMany",
	oho: "oho",
	obo: "obo",
	mbm: "mbm",
	belongstoarray: "belongsToArray",
	attachment: "m2m",
	updatedby: "belongsTo",
};

/**
 * Mapeamento de field.type para RelationInterface como fallback.
 * Usado quando field.interface é null/None mas field.type indica uma relação.
 */
const RELATION_TYPE_MAP: Record<string, RelationInterface> = {
	belongsTo: "belongsTo",
	belongsToArray: "belongsToArray",
	belongsToMany: "m2m",
	hasMany: "hasMany",
	hasOne: "hasOne",
};

export function resolveRelationInterface(
	value: string | null | undefined,
): RelationInterface | null {
	if (!value) {
		return null;
	}

	const normalized = value.trim().toLowerCase();
	return RELATION_INTERFACE_MAP[normalized] ?? null;
}

/**
 * Resolve o tipo de relação pelo field.type como fallback.
 * Usado quando field.interface é null/None mas field.type indica uma relação.
 */
export function resolveRelationByType(
	fieldType: string | null | undefined,
): RelationInterface | null {
	if (!fieldType) {
		return null;
	}

	return RELATION_TYPE_MAP[fieldType] ?? null;
}

// ============================================================
// Relation inference from field name (merged from relation-inference.ts)
// ============================================================

/**
 * Padrões de convenção para inferência automática de relações.
 * Ordem importa: padrões mais específicos devem vir primeiro.
 */
const RELATION_NAME_PATTERNS: Array<{
	pattern: RegExp;
	extractTarget: (match: RegExpMatchArray) => string;
	defaultType: "belongsTo" | "hasMany";
}> = [
	{
		pattern: /^id_([a-z_][a-z0-9_]*)$/i,
		extractTarget: (match) => match[1] ?? "",
		defaultType: "belongsTo",
	},
	{
		pattern: /^([a-z_][a-z0-9_]*)_id$/i,
		extractTarget: (match) => match[1] ?? "",
		defaultType: "belongsTo",
	},
	{
		pattern: /^(?:f_|a_)(?:nc_)?([a-z_][a-z0-9_]*)$/i,
		extractTarget: (match) => match[1] ?? "",
		defaultType: "belongsTo",
	},
];

const FIELD_BLACKLIST = [
	"id",
	"id_hash",
	"id_sessao",
	"id_token",
	"id_cache",
	"id_temp",
	"uuid",
	"guid",
];

export function inferRelationFromFieldName(
	fieldName: string,
): RelationInfo | null {
	if (FIELD_BLACKLIST.includes(fieldName.toLowerCase())) {
		return null;
	}

	for (const {
		pattern,
		extractTarget,
		defaultType,
	} of RELATION_NAME_PATTERNS) {
		const match = fieldName.match(pattern);
		if (match) {
			return {
				type: defaultType,
				targetCollection: extractTarget(match),
			};
		}
	}

	return null;
}

// ============================================================
// Cardinality helpers
// ============================================================

export function getRelationCardinality(
	relationType: RelationInterface,
): RelationCardinality {
	switch (relationType) {
		case "o2m":
		case "hasMany":
		case "m2m":
		case "manyToMany":
		case "mbm":
		case "belongsToArray":
			return "many";
		case "m2o":
		case "belongsTo":
		case "oho":
		case "obo":
		case "hasOne":
			return "one";
	}
}

// ============================================================
// Type rendering
// ============================================================

export function renderRelationValueType(
	targetCollection: string,
	cardinality: RelationCardinality,
	baseInterfaceNaming?: Partial<BaseInterfaceNamingConfig>,
): string {
	const targetType = targetCollection.trim()
		? toCollectionBaseTypeName(targetCollection, baseInterfaceNaming)
		: "unknown";

	return cardinality === "many" ? `${targetType}[]` : `${targetType} | null`;
}

/**
 * Gera o tipo Zod para um campo de relação.
 * Usa referências a schemas base quando a collection destino está disponível,
 * ou fallbacks para tipos primitivos quando não está.
 *
 * @param targetCollection - Nome da collection de destino
 * @param cardinality - Cardinalidade da relação ("one" ou "many")
 * @param availableCollections - Set com nomes das collections disponíveis no datasource
 * @returns String com o tipo Zod (ex: "z.lazy(() => usersBaseSchema.nullable())", "z.number().array()")
 */
export function renderRelationZodType(
	targetCollection: string,
	cardinality: RelationCardinality,
	availableCollections: ReadonlySet<string>,
): string {
	const targetCollectionTrimmed = targetCollection.trim();
	const isAvailable =
		targetCollectionTrimmed !== "" &&
		availableCollections.has(targetCollectionTrimmed);

	if (isAvailable) {
		const targetBaseSchemaName = toBaseSchemaName(targetCollectionTrimmed);
		const relationType =
			cardinality === "one"
				? `${targetBaseSchemaName}.nullable()`
				: `${targetBaseSchemaName}.array()`;

		// Sempre usa lazy + BaseSchema para evitar ciclos (self e cross-collection).
		return `z.lazy(() => ${relationType})`;
	}

	// Fallback para collections não disponíveis no datasource
	if (cardinality === "one") {
		return "z.number().nullable()";
	}
	return "z.number().array()";
}
