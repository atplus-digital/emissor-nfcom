import type { PipelineExecutionContext } from "@generators/lib/pipeline/context";
import type { TaskRunner } from "@shared/types";
import type { CollectionTypesMap } from "../@types/generation";
import type { DataSourceGenerationConfig } from "../@types/script";
import type { GenerateTypesPipelineCtx } from "./fetch-schemas";

// ──────────────────────────────────────────────
// Collection splitter
// ──────────────────────────────────────────────

interface SplitResult {
	mainCollections: CollectionTypesMap;
	splitCollections: Map<string, CollectionTypesMap>;
}

/**
 * Divide as collections em dois grupos:
 * - mainCollections: collections que não estão em splitConfig
 * - splitCollections: Map onde cada chave é uma collection do splitConfig
 */
function splitCollectionsByConfig(
	allCollections: CollectionTypesMap,
	splitConfig: string[],
): SplitResult {
	const mainCollections: CollectionTypesMap = {};
	const splitCollections = new Map<string, CollectionTypesMap>();

	if (splitConfig.length === 0) {
		return {
			mainCollections: allCollections,
			splitCollections,
		};
	}

	const splitSet = new Set(splitConfig);

	for (const [collectionName, types] of Object.entries(allCollections)) {
		if (splitSet.has(collectionName)) {
			splitCollections.set(collectionName, {
				[collectionName]: types,
			});
		} else {
			mainCollections[collectionName] = types;
		}
	}

	return {
		mainCollections,
		splitCollections,
	};
}

// ──────────────────────────────────────────────
// Stage: build-types
// ──────────────────────────────────────────────

/**
 * Maps raw field schemas to TypeScript type definitions and applies
 * collection splitting.
 *
 * 1. Takes collectionTypes from pipelineContext (produced by fetch-schemas).
 * 2. Applies collection splitting based on config.splitCollections.
 * 3. Stores mainCollections and splitCollections in pipelineContext.
 *
 * This stage merges the old build-types + split-collections logic into one.
 */
export async function buildTypes(
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

	if (!pipelineCtx?.collectionTypes) {
		throw new Error(
			"build-types: collectionTypes não encontrado em pipelineContext. " +
				"O estágio fetch-schemas deve ser executado antes.",
		);
	}

	const collectionTypes = pipelineCtx.collectionTypes;
	const totalCollections = Object.keys(collectionTypes).length;

	task.output = `🔧 Processando ${totalCollections} collection(s) para definições de tipos...`;

	// Apply collection splitting
	const { mainCollections, splitCollections } = splitCollectionsByConfig(
		collectionTypes,
		dataSource.splitCollections ?? [],
	);

	const mainCount = Object.keys(mainCollections).length;
	const splitCount = splitCollections.size;

	task.output = `📂 ${mainCount} main + ${splitCount} split collection(s)`;

	return {
		...context,
		pipelineContext: {
			...pipelineCtx,
			mainCollections,
			splitCollections,
		} satisfies GenerateTypesPipelineCtx,
	};
}
