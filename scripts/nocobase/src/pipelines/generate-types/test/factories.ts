import type {
	CollectionTypesMap,
	GeneratedTypes,
	RelationInfo,
} from "@generators/pipelines/generate-types/@types/generation";
import type { DataSourceField } from "@generators/pipelines/generate-types/@types/script-data-source";

/**
 * Cria um mock de DataSourceField com valores padrão.
 */
export function createMockField(
	overrides: Partial<{
		name: string;
		type: string;
		interface: string | null;
		target: string;
		uiSchema: DataSourceField["uiSchema"];
	}> = {},
): DataSourceField {
	return {
		name: "campo_teste",
		type: "string",
		interface: "input",
		...overrides,
	};
}

/**
 * Cria um GeneratedTypes (scalars + relations + enums) para uma collection.
 */
export function createMockGeneratedTypes(
	scalars: Record<string, string> = {},
	relations: Record<string, RelationInfo> = {},
	enums: GeneratedTypes["enums"] extends Map<string, infer V>
		? Record<string, V>
		: never = {},
	fieldLabels?: Record<string, string>,
	tableLabel = "Mock Collection",
): GeneratedTypes {
	const enumsMap = new Map(Object.entries(enums));
	const labels =
		fieldLabels ??
		Object.fromEntries(
			[...Object.keys(scalars), ...Object.keys(relations)].map((name) => [
				name,
				name,
			]),
		);
	return {
		scalars: new Map(Object.entries(scalars)),
		relations: new Map(Object.entries(relations)),
		enums: enumsMap,
		fieldLabels: new Map(Object.entries(labels)),
		tableLabel,
		schemaAvailable: true,
	};
}

/**
 * Cria um CollectionTypesMap simples a partir de um objeto de collections.
 */
export function createMockCollectionTypesMap(
	collections: Record<
		string,
		{
			scalars?: Record<string, string>;
			relations?: Record<string, RelationInfo>;
			enums?: Record<string, Array<{ value: string | number; label: string }>>;
			tableLabel?: string;
		}
	> = {},
): CollectionTypesMap {
	const map: CollectionTypesMap = {};
	for (const [name, types] of Object.entries(collections)) {
		map[name] = createMockGeneratedTypes(
			types.scalars ?? {},
			types.relations ?? {},
			types.enums ?? {},
			undefined,
			types.tableLabel ?? name,
		);
	}
	return map;
}
