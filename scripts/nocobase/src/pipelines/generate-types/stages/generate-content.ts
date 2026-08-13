import type { PipelineExecutionContext } from "@generators/lib/pipeline/context";
import type { TaskRunner } from "@shared/types";
import type { CollectionTypesMap } from "../@types/generation";
import type {
	BaseInterfaceNamingConfig,
	DataSourceGenerationConfig,
} from "../@types/script";
import { generateCollectionsFile } from "../content/collections-index";
import {
	generateContent,
	generateFileHeader,
	generateIndexContent,
	generateLabelsContent,
	generateSchemasContent,
} from "../content/content";
import {
	createBaseTypeIndex,
	withMainFileImports,
} from "../content/import-injector";
import { generateIndexWithAllExportsWithPaths } from "../content/split-index";
import { resolveBaseInterfaceNamingConfig, toFileName } from "../utils/naming";
import type { GenerateTypesPipelineCtx } from "./fetch-schemas";

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

const OTHER_FOLDER = "other";

// ──────────────────────────────────────────────
// Collection folder file generator
// ──────────────────────────────────────────────

function getImportPath(collectionName: string, isSplit: boolean): string {
	const folder = toFileName(collectionName);
	return isSplit ? `./${folder}` : `./${OTHER_FOLDER}/${folder}`;
}

/**
 * Gera os 3 arquivos por collection (folder structure).
 * Retorna Map<filePath, content> com paths como "pessoas/labels.ts".
 */
function generateCollectionFolderFiles(
	types: CollectionTypesMap,
	baseInterfaceNaming: BaseInterfaceNamingConfig,
	isSplit: boolean,
	prefix = "",
	allCollectionsMap?: CollectionTypesMap,
	splitCollectionNames: ReadonlySet<string> = new Set<string>(),
): Map<string, string> {
	const result = new Map<string, string>();
	const header = generateFileHeader();
	const currentCollectionInOtherFolder = prefix.startsWith(`${OTHER_FOLDER}/`);

	for (const [colName, colTypes] of Object.entries(types)) {
		const folder = `${prefix}${toFileName(colName)}`;

		const labelsContent = `${header}\n${generateLabelsContent(colName, colTypes)}`;
		const schemasContent = `${header}\n${generateSchemasContent(
			colName,
			colTypes,
			baseInterfaceNaming,
			{
				allCollectionsMap: isSplit ? (allCollectionsMap ?? types) : undefined,
				splitCollectionNames,
				currentCollectionInOtherFolder,
			},
		)}`;
		const indexContent = `${header}${generateIndexContent(colName, colTypes, baseInterfaceNaming, isSplit)}`;

		result.set(`${folder}/labels.ts`, labelsContent);
		result.set(`${folder}/schemas.ts`, schemasContent);
		result.set(`${folder}/index.ts`, indexContent);
	}

	return result;
}

// ──────────────────────────────────────────────
// Stage: generate-content
// ──────────────────────────────────────────────

/**
 * Generates TypeScript source code from the processed types.
 *
 * 1. Takes mainCollections and splitCollections from pipelineContext.
 * 2. Generates folder-based files for each collection (labels.ts, schemas.ts, index.ts).
 * 3. Generates top-level collections.ts and index.ts.
 * 4. Stores the generated file map in pipelineContext.
 */
export async function generateContentStage(
	context: PipelineExecutionContext<
		DataSourceGenerationConfig,
		GenerateTypesPipelineCtx
	>,
	task: TaskRunner,
): Promise<
	PipelineExecutionContext<DataSourceGenerationConfig, GenerateTypesPipelineCtx>
> {
	const { runtimeConfig: dataSource } = context;
	const pipelineCtx = context.pipelineContext as
		| GenerateTypesPipelineCtx
		| undefined;

	if (!pipelineCtx) {
		throw new Error("generate-content: pipelineContext não encontrado.");
	}

	if (!pipelineCtx.mainCollections && !pipelineCtx.splitCollections) {
		throw new Error(
			"generate-content: mainCollections/splitCollections não encontrados. " +
				"O estágio build-types deve ser executado antes.",
		);
	}

	const mainCollections = pipelineCtx.mainCollections ?? {};
	const splitCollections = pipelineCtx.splitCollections ?? new Map();
	const collectionTypes = pipelineCtx.collectionTypes ?? {};

	const baseInterfaceNaming = resolveBaseInterfaceNamingConfig(
		dataSource.baseInterfaceNaming,
	);

	const splitCollectionNamesSet = new Set(splitCollections.keys());
	const baseTypeIndex = createBaseTypeIndex(
		collectionTypes,
		baseInterfaceNaming,
	);

	const hasMainCollections = Object.keys(mainCollections).length > 0;

	task.output = `📝 Gerando conteúdo TypeScript (${Object.keys(collectionTypes).length} collection(s))...`;

	const fileContents = new Map<string, string>();

	// Generate main content with imports injected
	const mainContent = withMainFileImports(
		generateContent(mainCollections, baseInterfaceNaming),
		mainCollections,
		splitCollectionNamesSet,
		baseTypeIndex,
		baseInterfaceNaming,
	);

	if (!splitCollections || splitCollections.size === 0) {
		// No split collections — flat output
		const mainOutputPath = hasMainCollections ? "index.ts" : "_main.ts";
		fileContents.set(mainOutputPath, mainContent);

		return {
			...context,
			pipelineContext: {
				...pipelineCtx,
				fileContents,
			} satisfies GenerateTypesPipelineCtx,
		};
	}

	// Merge all collections for index/collections generation
	const mergedCollections: CollectionTypesMap = {
		...(hasMainCollections ? mainCollections : {}),
	};
	for (const collections of splitCollections.values()) {
		Object.assign(mergedCollections, collections);
	}

	// Build import paths
	const collectionPaths = new Map<string, string>();
	for (const name of splitCollections.keys()) {
		collectionPaths.set(name, getImportPath(name, true));
	}
	for (const name of Object.keys(mainCollections)) {
		collectionPaths.set(name, getImportPath(name, false));
	}

	// Generate collections.ts and index.ts
	const collectionsContent = generateCollectionsFile(
		mergedCollections,
		baseInterfaceNaming,
		collectionPaths,
	);
	const rootIndexContent = generateIndexWithAllExportsWithPaths(
		Object.keys(mergedCollections),
		collectionPaths,
		baseInterfaceNaming,
	);

	fileContents.set("collections.ts", collectionsContent);
	fileContents.set("index.ts", rootIndexContent);

	// Generate split collection folder files (at root)
	for (const [_name, types] of splitCollections) {
		const folderFiles = generateCollectionFolderFiles(
			types,
			baseInterfaceNaming,
			true,
			"",
			collectionTypes,
			splitCollectionNamesSet,
		);
		for (const [path, content] of folderFiles) {
			fileContents.set(path, content);
		}
	}

	// Generate main collection folder files (inside other/)
	for (const [name, types] of Object.entries(mainCollections)) {
		const folderFiles = generateCollectionFolderFiles(
			{ [name]: types },
			baseInterfaceNaming,
			true,
			`${OTHER_FOLDER}/`,
			collectionTypes,
			splitCollectionNamesSet,
		);
		for (const [path, content] of folderFiles) {
			fileContents.set(path, content);
		}
	}

	task.output = `✅ ${fileContents.size} arquivo(s) gerados`;

	return {
		...context,
		pipelineContext: {
			...pipelineCtx,
			fileContents,
		} satisfies GenerateTypesPipelineCtx,
	};
}
