import type { CollectionTypesMap } from "@generators/pipelines/generate-types/@types/generation";
import type { BaseInterfaceNamingConfig } from "@generators/pipelines/generate-types/@types/script";
import {
	toCollectionBaseTypeName,
	toFileName,
} from "@generators/pipelines/generate-types/utils/naming";

const IDENTIFIER_REFERENCE_REGEX = /[$A-Z_a-z][$0-9A-Z_a-z]*/g;

function buildCollectionBaseTypeIndex(
	collectionTypes: CollectionTypesMap,
	baseInterfaceNaming: BaseInterfaceNamingConfig,
): Map<string, string> {
	const index = new Map<string, string>();

	for (const collectionName of Object.keys(collectionTypes)) {
		index.set(
			toCollectionBaseTypeName(collectionName, baseInterfaceNaming),
			collectionName,
		);
	}

	return index;
}

/**
 * Removes string literals and template literals from TypeScript source
 * so that identifier matching doesn't pick up type names inside strings.
 */
function removeStringLiterals(content: string): string {
	// Match single-quoted, double-quoted, and template literal strings
	// Handles escaped quotes and basic escape sequences
	return content
		.replace(/'(?:[^'\\]|\\.)*'/g, '""')
		.replace(/"(?:[^"\\]|\\.)*"/g, '""')
		.replace(/`(?:[^`\\]|\\.)*`/g, "``");
}

function collectBaseTypeReferences(
	content: string,
	baseTypeIndex: ReadonlyMap<string, string>,
): Set<string> {
	const references = new Set<string>();
	// Strip string literals first to avoid false positives like
	// "Cliente Vai Pagar..." being matched as the Cliente type reference
	const contentWithoutStrings = removeStringLiterals(content);

	for (const match of contentWithoutStrings.matchAll(
		IDENTIFIER_REFERENCE_REGEX,
	)) {
		const [typeName] = match;
		if (baseTypeIndex.has(typeName)) {
			references.add(typeName);
		}
	}

	return references;
}

function addImport(
	importsBySource: Map<string, Set<string>>,
	source: string,
	typeName: string,
) {
	const existing = importsBySource.get(source);
	if (existing) {
		existing.add(typeName);
		return;
	}

	importsBySource.set(source, new Set([typeName]));
}

/**
 * Procura pela linha que contém "import { z } from" e retorna a posição após ela.
 * Retorna -1 se não encontrar.
 */
function findZodImportEnd(content: string): number {
	const match = content.match(
		/^import\s*\{[^}]*\b[zZ]\b[^}]*\}\s*from\s*["']z["']/m,
	);
	if (!match) {
		return -1;
	}
	const matchIndex = content.indexOf(match[0]);
	return matchIndex + match[0].length;
}

function injectImports(
	content: string,
	importsBySource: Map<string, Set<string>>,
): string {
	if (importsBySource.size === 0) {
		return content;
	}

	const importLines = [...importsBySource.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([source, typeNames]) => {
			const sortedTypeNames = [...typeNames].sort((a, b) => a.localeCompare(b));
			const singleLineImport = `import type { ${sortedTypeNames.join(", ")} } from "${source}";`;
			if (singleLineImport.length <= 80) {
				return singleLineImport;
			}

			return [
				"import type {",
				...sortedTypeNames.map((typeName) => `\t${typeName},`),
				`} from "${source}";`,
			].join("\n");
		});

	const importBlock = importLines.join("\n");

	// Para split files com Zod, insere após o import do zod
	const zodImportEnd = findZodImportEnd(content);
	if (zodImportEnd !== -1) {
		const afterZod = content.indexOf("\n", zodImportEnd);
		const insertPos = afterZod === -1 ? content.length : afterZod;
		const before = content.slice(0, insertPos);
		const after = content.slice(insertPos).replace(/^\n+/, "\n");
		return `${before}\n${importBlock}\n${after}`;
	}

	// Fallback: insere após header ou antes do conteúdo
	const headerEndIndex = content.indexOf("*/");

	if (headerEndIndex === -1) {
		return `${importBlock}\n\n${content}`;
	}

	const afterHeader = headerEndIndex + 2;
	const body = content.slice(afterHeader).replace(/^\n+/, "\n");
	return `${content.slice(0, afterHeader)}\n${importBlock}\n${body}`;
}

export function withMainFileImports(
	content: string,
	mainCollections: CollectionTypesMap,
	splitCollectionNames: ReadonlySet<string>,
	baseTypeIndex: Map<string, string>,
	baseInterfaceNaming: BaseInterfaceNamingConfig,
): string {
	const localBaseTypes = new Set(
		Object.keys(mainCollections).map((collectionName) =>
			toCollectionBaseTypeName(collectionName, baseInterfaceNaming),
		),
	);
	const importsBySource = new Map<string, Set<string>>();

	for (const typeName of collectBaseTypeReferences(content, baseTypeIndex)) {
		if (localBaseTypes.has(typeName)) {
			continue;
		}

		const sourceCollection = baseTypeIndex.get(typeName);
		if (!sourceCollection || !splitCollectionNames.has(sourceCollection)) {
			continue;
		}

		addImport(importsBySource, `./${toFileName(sourceCollection)}`, typeName);
	}

	return injectImports(content, importsBySource);
}

export function createBaseTypeIndex(
	collectionTypes: CollectionTypesMap,
	baseInterfaceNaming: BaseInterfaceNamingConfig,
): Map<string, string> {
	return buildCollectionBaseTypeIndex(collectionTypes, baseInterfaceNaming);
}

/** @internal Exported for unit tests covering import map merging. */
export function mergeImportBySource(
	importsBySource: Map<string, Set<string>>,
	source: string,
	typeName: string,
): void {
	addImport(importsBySource, source, typeName);
}

/** @internal Exported for unit tests covering import injection placement. */
export function injectTypeImports(
	content: string,
	importsBySource: Map<string, Set<string>>,
): string {
	return injectImports(content, importsBySource);
}
