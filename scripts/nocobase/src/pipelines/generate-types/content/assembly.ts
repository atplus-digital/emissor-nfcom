import type {
	CollectionTypesMap,
	GeneratedTypes,
} from "@generators/pipelines/generate-types/@types/generation";
import type { BaseInterfaceNamingConfig } from "@generators/pipelines/generate-types/@types/script";
import {
	toBaseSchemaName,
	toCollectionConstantPrefix,
	toFileName,
} from "@generators/pipelines/generate-types/utils/naming";
import {
	generateCollectionEnumMaps,
	generateCollectionEnumSchemas,
	generateCollectionEnumTypes,
	generateEnumLabelsByFieldMap,
	toEnumMemberName,
} from "./enums";
import {
	generateBaseSchema,
	generateCollectionInterfaces,
	generateCreateSchema,
	generateMergedMainSchema,
	generateRelationSchema,
	generateUpdateSchema,
} from "./interfaces";
/**
 * Gera o header do arquivo TypeScript gerado.
 */
export function generateFileHeader(): string {
	return `/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: bun run generate:types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */
`;
}

/**
 * Gera o import do zod.
 */
function generateZodImport(): string {
	return `import { z } from "zod";`;
}

function appendTableMetadataConsts(
	lines: string[],
	collectionName: string,
	tableLabel: string,
): void {
	lines.push(`export const TABLE_NAME = ${JSON.stringify(collectionName)};`);
	lines.push(`export const TABLE_LABEL = ${JSON.stringify(tableLabel)};`);
	lines.push("");
}

function _ensureValidIdentifier(name: string): string {
	if (/^[0-9]/.test(name)) {
		return `_${name}`;
	}
	return name;
}

function generateFieldLabelsMap(
	collectionName: string,
	types: GeneratedTypes,
): string {
	const labelsName = `${toCollectionConstantPrefix(collectionName)}_FIELD_LABELS`;
	const entries = Array.from(types.fieldLabels.entries())
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([fieldName, label]) => {
			const escapedLabel = `'${label.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
			return `\t${JSON.stringify(fieldName)}: ${escapedLabel}`;
		})
		.join(",\n");

	return `export const ${labelsName} = {\n${entries}\n} as const;\n\nexport const FIELD_LABELS = ${labelsName};`;
}

function resolveExternalSchemaImportPath(
	targetFolder: string,
	targetIsSplitCollection: boolean,
	currentCollectionInOtherFolder: boolean,
	hasSplitFolderLayout: boolean,
): string {
	if (!hasSplitFolderLayout) {
		return `../${targetFolder}/schemas`;
	}

	if (currentCollectionInOtherFolder) {
		return targetIsSplitCollection
			? `../../${targetFolder}/schemas`
			: `../${targetFolder}/schemas`;
	}

	return targetIsSplitCollection
		? `../${targetFolder}/schemas`
		: `../other/${targetFolder}/schemas`;
}

interface GenerateSchemasContentOptions {
	allCollectionsMap?: CollectionTypesMap;
	splitCollectionNames?: ReadonlySet<string>;
	currentCollectionInOtherFolder?: boolean;
}

function generateRelationTargetsMap(
	collectionName: string,
	types: GeneratedTypes,
	availableCollections: Set<string>,
): string {
	if (types.relations.size === 0) {
		return "export const RELATION_TARGETS = {} as const;";
	}

	const entries: string[] = [];
	for (const [relationKey, relation] of types.relations) {
		const target = relation.targetCollection.trim();
		if (
			target &&
			target !== collectionName &&
			availableCollections.has(target)
		) {
			entries.push(
				`\t${JSON.stringify(relationKey)}: ${JSON.stringify(target)},`,
			);
		}
	}

	entries.sort();
	if (entries.length === 0) {
		return "export const RELATION_TARGETS = {} as const;";
	}

	return `export const RELATION_TARGETS = {\n${entries.join("\n")}\n} as const;`;
}

/**
 * Gera o conteúdo do arquivo labels.ts para uma collection.
 *
 * Ordem:
 * 1. Import do zod
 * 2. Labels (single source of truth)
 * 3. Enum Schemas
 * 4. Enum Types
 */
export function generateLabelsContent(
	collectionName: string,
	types: GeneratedTypes,
): string {
	const lines: string[] = [];

	// 1. Import do zod (apenas se há enums)
	if (types.enums.size > 0) {
		lines.push(generateZodImport());
	}

	if (types.fieldLabels.size > 0 || types.enums.size > 0) {
		lines.push("");
		lines.push(
			"// ============================================================",
		);
		lines.push("// LABELS (single source of truth)");
		lines.push(
			"// ============================================================",
		);
		if (types.fieldLabels.size > 0) {
			lines.push(generateFieldLabelsMap(collectionName, types));
		} else {
			lines.push("export const FIELD_LABELS = {} as const;");
		}
		if (types.enums.size > 0) {
			lines.push("");
			lines.push(generateCollectionEnumMaps(collectionName, types));
		}
	} else {
		lines.push("export const FIELD_LABELS = {} as const;");
	}

	lines.push("");
	lines.push(generateEnumLabelsByFieldMap(collectionName, types));

	if (types.enums.size > 0) {
		lines.push("");
		lines.push(
			"// ============================================================",
		);
		lines.push("// ENUM SCHEMAS (validação em runtime)");
		lines.push(
			"// ============================================================",
		);
		lines.push(generateCollectionEnumSchemas(collectionName, types));
		lines.push("");
		lines.push(
			"// ============================================================",
		);
		lines.push("// ENUM TYPES (inferidos dos schemas)");
		lines.push(
			"// ============================================================",
		);
		lines.push(generateCollectionEnumTypes(collectionName, types));
	}

	return lines.join("\n");
}

/**
 * Gera o conteúdo do arquivo schemas.ts para uma collection.
 *
 * Ordem:
 * 1. Import do zod
 * 2. Import de schemas de enum do ./labels
 * 3. Import de schemas de outras collections
 * 4. TABLE_NAME const
 * 5. Base Schema
 * 6. Relation Schema
 * 7. Main Schema (merge)
 * 8. Create Schema
 * 9. Update Schema
 */
export function generateSchemasContent(
	collectionName: string,
	types: GeneratedTypes,
	baseInterfaceNaming?: Partial<BaseInterfaceNamingConfig>,
	options: GenerateSchemasContentOptions = {},
): string {
	const {
		allCollectionsMap,
		splitCollectionNames = new Set<string>(),
		currentCollectionInOtherFolder = false,
	} = options;

	const lines: string[] = [];

	// Available collections para resolver referências de schemas
	const availableCollections = new Set<string>(
		allCollectionsMap ? Object.keys(allCollectionsMap) : [],
	);

	const baseSchema = generateBaseSchema(collectionName, types);
	const { content: relationSchemaContent } = generateRelationSchema(
		collectionName,
		types,
		availableCollections,
		baseInterfaceNaming,
	);
	const mainSchema = generateMergedMainSchema(collectionName, types);
	const createSchema = generateCreateSchema(collectionName, types);
	const updateSchema = generateUpdateSchema(collectionName, types);
	const hasSchemaContent =
		!!baseSchema ||
		!!relationSchemaContent ||
		!!mainSchema ||
		!!createSchema ||
		!!updateSchema;

	// 1. Import do zod (apenas quando algum schema zod é gerado)
	if (hasSchemaContent) {
		lines.push(generateZodImport());
	}

	// 2. Import de schemas de enum do ./labels (se houver enums)
	if (types.enums.size > 0) {
		const enumSchemaNames = Array.from(types.enums.keys())
			.sort()
			.map((fieldName) => {
				// Compute the enum schema name using the same logic as getEnumFieldInfo
				const cleanCollectionName = collectionName.replace(/^t_/, "");
				const fieldNameWithoutPrefix = fieldName.replace(/^[tf]_/, "");
				const pascalField = toEnumMemberName(fieldNameWithoutPrefix);
				const schemaName = _ensureValidIdentifier(
					`${cleanCollectionName.toLowerCase()}${pascalField}Schema`,
				);
				return schemaName;
			});

		if (enumSchemaNames.length <= 5) {
			lines.push(`import { ${enumSchemaNames.join(", ")} } from "./labels";`);
		} else {
			lines.push("import {");
			for (const name of enumSchemaNames) {
				lines.push(`\t${name},`);
			}
			lines.push('} from "./labels";');
		}
	}

	// 3. Cross-collection schema imports (other collections' base schemas)
	const externalImports = new Map<string, Set<string>>();
	const hasSplitFolderLayout = splitCollectionNames.size > 0;
	for (const [_, relation] of types.relations) {
		const target = relation.targetCollection.trim();
		if (
			target &&
			availableCollections.has(target) &&
			target !== collectionName
		) {
			const schemaName = toBaseSchemaName(target);
			const targetIsSplitCollection = splitCollectionNames.has(target);
			const importPath = resolveExternalSchemaImportPath(
				toFileName(target),
				targetIsSplitCollection,
				currentCollectionInOtherFolder,
				hasSplitFolderLayout,
			);
			const existing = externalImports.get(importPath);
			if (existing) {
				existing.add(schemaName);
			} else {
				externalImports.set(importPath, new Set([schemaName]));
			}
		}
	}

	// Ordena por importPath para garantir output determinístico, independentemente
	// da ordem em que a API retorna os campos de relação.
	const sortedImportEntries = [...externalImports.entries()].sort(([a], [b]) =>
		a.localeCompare(b),
	);
	for (const [importPath, schemaNames] of sortedImportEntries) {
		const sorted = [...schemaNames].sort();
		if (sorted.length <= 4) {
			lines.push(`import { ${sorted.join(", ")} } from "${importPath}";`);
		} else {
			lines.push("import {");
			for (const name of sorted) {
				lines.push(`\t${name},`);
			}
			lines.push(`} from "${importPath}";`);
		}
	}

	if (types.enums.size > 0 || externalImports.size > 0) {
		lines.push("");
	}

	// 4. TABLE_NAME + TABLE_LABEL
	appendTableMetadataConsts(
		lines,
		collectionName,
		types.tableLabel ?? collectionName,
	);

	// 5. Base Schema (campos escalares)
	if (baseSchema) {
		lines.push(
			"// ============================================================",
		);
		lines.push("// BASE SCHEMA (campos escalares)");
		lines.push(
			"// ============================================================",
		);
		lines.push(baseSchema);
		lines.push("");
	}

	// 5. Relation Schema (campos de relação)
	if (relationSchemaContent) {
		lines.push(
			"// ============================================================",
		);
		lines.push("// RELATION SCHEMA (campos de relação)");
		lines.push(
			"// ============================================================",
		);
		lines.push(relationSchemaContent);
		lines.push("");
		lines.push(
			generateRelationTargetsMap(collectionName, types, availableCollections),
		);
		lines.push("");
	} else {
		lines.push("export const RELATION_TARGETS = {} as const;");
		lines.push("");
	}

	// 6. Main Schema (merge de base + relation)
	if (mainSchema) {
		lines.push(
			"// ============================================================",
		);
		lines.push("// SCHEMA PRINCIPAL (validação completa)");
		lines.push(
			"// ============================================================",
		);
		lines.push(mainSchema);
		lines.push("");
	}

	// 7. Create Schema (omit campos auto-gerados)
	if (createSchema) {
		lines.push(
			"// ============================================================",
		);
		lines.push("// CREATE SCHEMA");
		lines.push(
			"// ============================================================",
		);
		lines.push(createSchema);
		lines.push("");
	}

	// 8. Update Schema (partial do create)
	if (updateSchema) {
		lines.push(
			"// ============================================================",
		);
		lines.push("// UPDATE SCHEMA");
		lines.push(
			"// ============================================================",
		);
		lines.push(updateSchema);
	}

	return lines.join("\n");
}

/**
 * Gera o conteúdo do arquivo index.ts (barrel) para uma collection.
 *
 * Ordem:
 * 1. Re-export de labels/enums do ./labels
 * 2. Re-export de schemas do ./schemas
 * 3. Type Principal (z.infer do main schema)
 * 4. Relations Type (z.infer do relation schema)
 * 5. RelationKey Type
 */
export function generateIndexContent(
	collectionName: string,
	types: GeneratedTypes,
	baseInterfaceNaming?: Partial<BaseInterfaceNamingConfig>,
	isSplitCollection = false,
): string {
	const interfaces = generateCollectionInterfaces(
		collectionName,
		types,
		baseInterfaceNaming,
		isSplitCollection,
	);

	const lines: string[] = [];
	const hasMainSchema = types.scalars.size > 0 || types.relations.size > 0;

	// Import do zod para z.infer (split collections)
	if (isSplitCollection && hasMainSchema) {
		lines.push(generateZodImport());
		lines.push("");
	}

	// 1. Re-export labels (sempre presente — analytics carrega via import.meta.glob)
	lines.push("// Re-exports: Labels + Enums");
	lines.push(`export * from "./labels";`);
	lines.push("");

	// 2. Re-export schemas (TABLE_NAME, zod schemas)
	lines.push("// Re-exports: Schemas");
	lines.push(`export * from "./schemas";`);
	lines.push("");

	// 3. Type Principal
	if (isSplitCollection) {
		lines.push("// Type inferences");
		const typeName = interfaces.typeName;
		if (hasMainSchema) {
			const schemaName = interfaces.schemaName;
			lines.push(
				`export type ${typeName} = z.infer<typeof import("./schemas").${schemaName}>;`,
			);
		} else {
			lines.push(`export type ${typeName} = Record<string, never>;`);
		}
	} else {
		// Non-split: gera interface base exportada do barrel
		if (interfaces.baseInterface) {
			lines.push(interfaces.baseInterface);
			lines.push("");
		}
	}

	// 4. Relations Type
	lines.push(interfaces.relationsInterface);
	lines.push("");

	// 5. RelationKey Type
	lines.push(interfaces.relationKeyType);

	return lines.join("\n");
}

/**
 **
 *
 * Gera a definição completa de tipos para uma collection em um único arquivo.
 */
function generateCollectionTypes(
	collectionName: string,
	types: GeneratedTypes,
	baseInterfaceNaming?: Partial<BaseInterfaceNamingConfig>,
	includeSourceTableConst = false,
	isSplitCollection = false,
	allCollectionsMap?: CollectionTypesMap,
): string {
	const lines: string[] = [];

	// Available collections para resolver referências de schemas
	const availableCollections = new Set<string>(
		allCollectionsMap ? Object.keys(allCollectionsMap) : [],
	);

	// 1. Import do zod quando há infer/schema (split) ou enums (non-split)
	if (isSplitCollection || types.enums.size > 0) {
		lines.push(generateZodImport());
		lines.push("");
	}

	// 2. TABLE_NAME + TABLE_LABEL
	if (includeSourceTableConst) {
		appendTableMetadataConsts(
			lines,
			collectionName,
			types.tableLabel ?? collectionName,
		);
	}

	// 3. Labels (single source of truth)
	if (types.enums.size > 0) {
		lines.push(
			"// ============================================================",
		);
		lines.push("// LABELS (single source of truth)");
		lines.push(
			"// ============================================================",
		);
		lines.push(generateCollectionEnumMaps(collectionName, types));
		lines.push("");
	}

	// 4. Enum Schemas (extraídos das labels)
	if (types.enums.size > 0) {
		lines.push(
			"// ============================================================",
		);
		lines.push("// ENUM SCHEMAS (validação em runtime)");
		lines.push(
			"// ============================================================",
		);
		lines.push(generateCollectionEnumSchemas(collectionName, types));
		lines.push("");
	}

	// 5. Enum Types (inferidos dos schemas)
	if (types.enums.size > 0) {
		lines.push(
			"// ============================================================",
		);
		lines.push("// ENUM TYPES (inferidos dos schemas)");
		lines.push(
			"// ============================================================",
		);
		lines.push(generateCollectionEnumTypes(collectionName, types));
		lines.push("");
	}

	// Gera interfaces (nomes de schema, type, etc.)
	const interfaces = generateCollectionInterfaces(
		collectionName,
		types,
		baseInterfaceNaming,
		isSplitCollection,
	);

	if (isSplitCollection) {
		// 6. Base Schema (campos escalares)
		const baseSchema = generateBaseSchema(collectionName, types);
		if (baseSchema) {
			lines.push(
				"// ============================================================",
			);
			lines.push("// BASE SCHEMA (campos escalares)");
			lines.push(
				"// ============================================================",
			);
			lines.push(baseSchema);
			lines.push("");
		}

		// 7. Relation Schema (campos de relação)
		const { content: relationSchemaContent } = generateRelationSchema(
			collectionName,
			types,
			availableCollections,
			baseInterfaceNaming,
		);
		if (relationSchemaContent) {
			lines.push(
				"// ============================================================",
			);
			lines.push("// RELATION SCHEMA (campos de relação)");
			lines.push(
				"// ============================================================",
			);
			lines.push(relationSchemaContent);
			lines.push("");
		}

		// 8. Main Schema (merge de base + relation)
		const mainSchema = generateMergedMainSchema(collectionName, types);
		if (mainSchema) {
			lines.push(
				"// ============================================================",
			);
			lines.push("// SCHEMA PRINCIPAL (validação completa)");
			lines.push(
				"// ============================================================",
			);
			lines.push(mainSchema);
			lines.push("");
		}

		// 9. Create Schema (omit campos auto-gerados)
		const createSchema = generateCreateSchema(collectionName, types);
		if (createSchema) {
			lines.push(
				"// ============================================================",
			);
			lines.push("// CREATE SCHEMA");
			lines.push(
				"// ============================================================",
			);
			lines.push(createSchema);
			lines.push("");
		}

		// 10. Update Schema (partial do create)
		const updateSchema = generateUpdateSchema(collectionName, types);
		if (updateSchema) {
			lines.push(
				"// ============================================================",
			);
			lines.push("// UPDATE SCHEMA");
			lines.push(
				"// ============================================================",
			);
			lines.push(updateSchema);
			lines.push("");
		}

		// 11. Type Principal (inferido do schema)
		lines.push(
			"// ============================================================",
		);
		lines.push("// TYPE PRINCIPAL (inferido do schema)");
		lines.push(
			"// ============================================================",
		);
		const typeName = interfaces.typeName;
		const schemaName = interfaces.schemaName;
		lines.push(`export type ${typeName} = z.infer<typeof ${schemaName}>;`);
		lines.push("");
	} else {
		// Non-split: gera interface base normalmente
		lines.push(interfaces.baseInterface);
		lines.push("");
	}

	// 12. Relations Type
	lines.push(interfaces.relationsInterface);
	lines.push("");

	// 13. RelationKey Type
	lines.push(interfaces.relationKeyType);

	return lines.join("\n");
}

/**
 * Gera conteúdo TypeScript para um subset de collections.
 * Permite gerar múltiplos arquivos com diferentes collections.
 */
export function _generateContentForCollections(
	collections: CollectionTypesMap,
	includeHeader = true,
	baseInterfaceNaming?: Partial<BaseInterfaceNamingConfig>,
	includeSourceTableConst = false,
	isSplitCollection = false,
): string {
	const lines: string[] = [];

	if (includeHeader) {
		lines.push(generateFileHeader());
	}

	const sortedCollections = Object.entries(collections).sort(([a], [b]) =>
		a.localeCompare(b),
	);

	for (const [collectionName, types] of sortedCollections) {
		lines.push(
			generateCollectionTypes(
				collectionName,
				types,
				baseInterfaceNaming,
				includeSourceTableConst,
				isSplitCollection,
				collections,
			),
		);
		lines.push("");
	}

	const content = lines.join("\n");

	// Arquivo consolidado (non-split): mantém apenas um import do zod no topo.
	if (isSplitCollection) {
		return content;
	}

	const zodImport = 'import { z } from "zod";';
	const firstImportIndex = content.indexOf(zodImport);
	if (firstImportIndex === -1) {
		return content;
	}

	const beforeFirstImport = content.slice(
		0,
		firstImportIndex + zodImport.length,
	);
	const afterFirstImport = content.slice(firstImportIndex + zodImport.length);
	const dedupedAfter = afterFirstImport.replaceAll(`\n${zodImport}`, "");
	return `${beforeFirstImport}${dedupedAfter}`;
}

/**
 * Gera múltiplos arquivos TypeScript por collection (folder structure).
 *
 * Cada collection gera 3 arquivos:
 * - {collection}/labels.ts  → Labels + Enum Schemas + Enum Types
 * - {collection}/schemas.ts → Zod schemas + TABLE_NAME const
 * - {collection}/index.ts   → Barrel re-exports + type inferences
 *
 * Retorna Map<filePath, content> onde filePath é relativo (ex: "pessoas/labels.ts")
 */

/**
 * Gera conteúdo TypeScript completo com header.
 */
export function generateContent(
	collectionTypes: CollectionTypesMap,
	baseInterfaceNaming?: Partial<BaseInterfaceNamingConfig>,
): string {
	return _generateContentForCollections(
		collectionTypes,
		true,
		baseInterfaceNaming,
	);
}
