import type { NocoBaseApiClient } from "@generators/http/nocobase-client";
import type { PipelineExecutionContext } from "@generators/pipeline/context";
import type { TaskRunner } from "@generators/types";
import type { CollectionTypesMap, RelationInfo } from "../@types/generation";
import type {
	DataSourceCollection,
	DataSourceField,
	DataSourceGenerationConfig,
	ManualRelationMapping,
} from "../@types/script";
import { extractRelationInfo, mapFieldType } from "../content/field-mapper";
import { toFileName } from "../utils/naming";
import {
	resolveCollectionLabel,
	resolveFieldLabel,
} from "../utils/resolve-label";

// ──────────────────────────────────────────────
// Pipeline context types (shared across stages)
// ──────────────────────────────────────────────

export interface GenerateTypesPipelineCtx {
	// Input (set by orchestrator before first stage)
	client: NocoBaseApiClient;
	dataSource: DataSourceGenerationConfig;
	relations: Record<string, ManualRelationMapping>;

	// Stage 1: fetch-schemas
	collectionTypes?: CollectionTypesMap;

	// Stage 2: build-types
	mainCollections?: CollectionTypesMap;
	splitCollections?: Map<string, CollectionTypesMap>;

	// Stage 3: generate-content
	fileContents?: Map<string, string>;
}

/**
 * Full stage context for the generate-types pipeline: kernel base
 * (tempDir/outputDirs) + per-datasource runtime config + pipeline ctx.
 */
export type GenerateTypesStageCtx = PipelineExecutionContext & {
	runtimeConfig: DataSourceGenerationConfig;
	pipelineContext: GenerateTypesPipelineCtx;
};

// ──────────────────────────────────────────────
// Field processing helpers
// ──────────────────────────────────────────────

function extractEnumsFromField(
	field: DataSourceField,
): Array<{ value: string | number; label: string }> | null {
	if (
		field.uiSchema?.enum &&
		Array.isArray(field.uiSchema.enum) &&
		field.uiSchema.enum.length > 0
	) {
		// uiSchema.enum can be either flat values or {value, label} objects
		return field.uiSchema.enum.map((opt) => {
			if (typeof opt === "object" && opt !== null && "value" in opt) {
				return { value: opt.value, label: opt.label ?? String(opt.value) };
			}
			return { value: String(opt), label: String(opt) };
		});
	}
	return null;
}

function extractRelationFromField(
	field: DataSourceField,
	manualRelations: ManualRelationMapping | undefined,
	inferRelationsByName: boolean,
): RelationInfo | null {
	return extractRelationInfo(field, manualRelations, inferRelationsByName);
}

function normalizeCollectionNames(collectionNames: string[]): string[] {
	return Array.from(
		new Set(collectionNames.map((name) => name.trim()).filter(Boolean)),
	);
}

/**
 * Resolve nomes configurados (de `collections`/`splitCollections`) para os
 * **nomes reais** retornados pela API do datasource.
 *
 * A config pode vir em três formas: nome real da API (`t_linhas_fixas`),
 * slug kebab da pasta (`linhas-fixas`) ou nome com underscore (`cliente_contrato`).
 * O pipeline trabalha end-to-end com o nome real; esta função normaliza a entrada
 * casando por `toFileName` (kebab, sem prefixo `t_`/`f_`) com fallback exact-match.
 *
 * Nomes configurados sem correspondência na API são mantidos como-is — o estágio
 * os marca como `schemaAvailable=false` (orphan), sem inventar nome.
 */
function resolveToApiNames(
	configuredNames: string[],
	apiCollections: DataSourceCollection[],
): string[] {
	const byFileName = new Map<string, string>();
	for (const c of apiCollections) {
		byFileName.set(toFileName(c.name), c.name);
	}

	return configuredNames.map(
		(name) => byFileName.get(toFileName(name)) ?? name,
	);
}

function resolveSplitDependents(
	apiCollections: DataSourceCollection[],
	splitCollectionNames: string[],
	relationsMapping: Record<string, ManualRelationMapping> | undefined,
	inferRelationsByName: boolean,
): string[] {
	const normalizedSplitCollections =
		normalizeCollectionNames(splitCollectionNames);
	if (normalizedSplitCollections.length === 0) {
		return [];
	}

	const splitSet = new Set(normalizedSplitCollections);
	const dependentCollections = new Set<string>();
	const collectionLookup = new Map(
		apiCollections.map((collection) => [collection.name, collection]),
	);

	const addDependent = (collectionName: string | null | undefined): void => {
		const normalizedName = collectionName?.trim();
		if (!normalizedName || splitSet.has(normalizedName)) {
			return;
		}
		dependentCollections.add(normalizedName);
	};

	// Dependências de saída: splitCollection -> targetCollection
	for (const splitCollectionName of normalizedSplitCollections) {
		const splitCollection = collectionLookup.get(splitCollectionName);
		const splitManualMapping = relationsMapping?.[splitCollectionName];

		for (const relationDef of Object.values(splitManualMapping ?? {})) {
			addDependent(relationDef.target);
		}

		for (const field of splitCollection?.fields ?? []) {
			const relation = extractRelationFromField(
				field,
				splitManualMapping,
				inferRelationsByName,
			);
			addDependent(relation?.targetCollection);
		}
	}

	// Dependências de entrada: otherCollection -> splitCollection
	for (const apiCollection of apiCollections) {
		const collectionName = apiCollection.name?.trim();
		if (!collectionName || splitSet.has(collectionName)) {
			continue;
		}

		const manualMapping = relationsMapping?.[collectionName];
		const isManualDependent = Object.values(manualMapping ?? {}).some((rel) =>
			splitSet.has(rel.target.trim()),
		);

		if (isManualDependent) {
			dependentCollections.add(collectionName);
			continue;
		}

		const isFieldDependent = (apiCollection.fields ?? []).some((field) => {
			const relation = extractRelationFromField(
				field,
				manualMapping,
				inferRelationsByName,
			);
			const targetCollection = relation?.targetCollection?.trim();
			return Boolean(targetCollection && splitSet.has(targetCollection));
		});

		if (isFieldDependent) {
			dependentCollections.add(collectionName);
		}
	}

	return Array.from(dependentCollections);
}

// ──────────────────────────────────────────────
// Stage: fetch-schemas
// ──────────────────────────────────────────────

/**
 * Fetch collections and their field schemas from the API.
 *
 * 1. Resolves the list of collections to process from config.collections
 *    and config.splitCollections (union of both).
 * 2. For each collection, fetches fields via the client.
 * 3. Extracts scalars, relations, and enums from each field.
 * 4. Stores the results in context.pipelineContext.
 */
export async function fetchSchemas(
	context: GenerateTypesStageCtx,
	task: TaskRunner,
): Promise<GenerateTypesStageCtx> {
	const { runtimeConfig: dataSource } = context;
	const pipelineCtx = context.pipelineContext as
		| GenerateTypesPipelineCtx
		| undefined;

	if (!pipelineCtx?.client) {
		throw new Error(
			"fetch-schemas: client não encontrado em pipelineContext. " +
				"O orquestrador deve fornecer uma instância de NocoBaseApiClient.",
		);
	}

	const client = pipelineCtx.client;
	const inferRelationsByName = dataSource.inferRelationsByName ?? false;

	// Fetch raw API collection list for relation resolution and optional expansion
	let apiCollections: DataSourceCollection[];
	try {
		apiCollections = (await client.fetchCollections(
			dataSource.dataSource,
		)) as DataSourceCollection[];
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(
			`Falha ao listar collections do datasource '${dataSource.dataSource}': ${message}`,
		);
	}

	// 1. Resolve collection names from config.
	// Configured names (slug kebab, underscore, or real API name) are normalized
	// to the REAL API name so lookups downstream (by apiCollection.name) match.
	const configuredSplitCollections = resolveToApiNames(
		normalizeCollectionNames(dataSource.splitCollections ?? []),
		apiCollections,
	);
	const explicitCollections = normalizeCollectionNames([
		...resolveToApiNames(
			normalizeCollectionNames(dataSource.collections ?? []),
			apiCollections,
		),
		...configuredSplitCollections,
	]);
	const includeAllCollections = dataSource.includeAllCollections === true;
	const includeDependents =
		!includeAllCollections && dataSource.includeDependents === true;

	const dependentCollections = includeDependents
		? resolveSplitDependents(
				apiCollections,
				configuredSplitCollections,
				pipelineCtx.relations,
				inferRelationsByName,
			)
		: [];

	const resolvedCollections = includeAllCollections
		? [
				...explicitCollections,
				...apiCollections.map((collection) => collection.name),
			]
		: [...explicitCollections, ...dependentCollections];

	const normalizedCollections = normalizeCollectionNames(resolvedCollections);

	if (normalizedCollections.length === 0) {
		throw new Error(
			`DataSource '${dataSource.name}' não possui collections para processar. ` +
				"Configure collections/splitCollections, habilite includeAllCollections ou use includeDependents em datasources.ts.",
		);
	}

	const dependentsSummary =
		includeDependents && dependentCollections.length > 0
			? ` (+${dependentCollections.length} dependente(s))`
			: "";
	task.output = `📦 Processando ${normalizedCollections.length} collection(s) do datasource '${dataSource.name}'${dependentsSummary}...`;

	const collectionLookup = new Map(apiCollections.map((c) => [c.name, c]));
	const knownCollections = new Set([
		...apiCollections.map((c) => c.name),
		...normalizedCollections,
	]);

	// 2. Process fields from the API response for configured collections
	const excludeFields = new Set(dataSource.excludeFields ?? []);

	const entries: Array<{
		collectionName: string;
		generated: {
			scalars: Map<string, string>;
			relations: Map<string, RelationInfo>;
			enums: Map<string, Array<{ value: string | number; label: string }>>;
			fieldLabels: Map<string, string>;
			tableLabel: string;
			schemaAvailable: boolean;
		};
		unresolved: Array<{ field: string; target: string }>;
	}> = [];

	for (const [index, collectionName] of normalizedCollections.entries()) {
		if (index % 25 === 0) {
			task.output = `📦 [${index + 1}/${normalizedCollections.length}] Processando collection '${collectionName}'...`;
		}

		const apiCollection = collectionLookup.get(collectionName);
		const fields = (apiCollection?.fields ?? []) as DataSourceField[];
		const schemaAvailable = !!apiCollection;

		const scalars = new Map<string, string>();
		const relations = new Map<string, RelationInfo>();
		const enums = new Map<
			string,
			Array<{ value: string | number; label: string }>
		>();
		const fieldLabels = new Map<string, string>();
		const collectionUnresolved: Array<{ field: string; target: string }> = [];

		for (const field of fields) {
			if (excludeFields.has(field.name)) continue;
			fieldLabels.set(field.name, resolveFieldLabel(field));

			// Try relation first
			const manualRelations = pipelineCtx.relations?.[collectionName];
			const relationInfo = extractRelationFromField(
				field,
				manualRelations,
				inferRelationsByName,
			);

			if (relationInfo) {
				const isAvailable = knownCollections.has(relationInfo.targetCollection);
				relations.set(field.name, {
					type: relationInfo.type,
					targetCollection: isAvailable ? relationInfo.targetCollection : "",
					originalTarget: relationInfo.targetCollection || undefined,
				});

				if (!isAvailable && relationInfo.targetCollection) {
					collectionUnresolved.push({
						field: field.name,
						target: relationInfo.targetCollection,
					});
				}
				continue;
			}

			// Otherwise it's a scalar
			scalars.set(field.name, mapFieldType(field));

			// Extract enums from uiSchema
			const enumValues = extractEnumsFromField(field);
			if (enumValues) {
				enums.set(field.name, enumValues);
			}
		}

		// Apply manual relation mappings (not already covered)
		const manualMapping = pipelineCtx.relations?.[collectionName];
		if (manualMapping) {
			for (const [fieldName, relationDef] of Object.entries(manualMapping)) {
				if (!relations.has(fieldName)) {
					const isAvailable = knownCollections.has(relationDef.target);
					relations.set(fieldName, {
						type: relationDef.type,
						targetCollection: isAvailable ? relationDef.target : "",
						originalTarget: relationDef.target || undefined,
					});

					if (!isAvailable && relationDef.target) {
						collectionUnresolved.push({
							field: fieldName,
							target: relationDef.target,
						});
					}
				}
			}
		}

		const generated = {
			scalars,
			relations,
			enums,
			fieldLabels,
			tableLabel: resolveCollectionLabel(collectionName, apiCollection),
			schemaAvailable,
		};

		entries.push({
			collectionName,
			generated,
			unresolved: collectionUnresolved,
		});
	}

	// 3. Assemble results
	const collectionTypes: CollectionTypesMap = {};
	const allUnresolved: Array<{
		collection: string;
		field: string;
		target: string;
	}> = [];

	for (const { collectionName, generated, unresolved } of entries) {
		collectionTypes[collectionName] = generated;
		for (const rel of unresolved) {
			allUnresolved.push({
				collection: collectionName,
				field: rel.field,
				target: rel.target,
			});
		}
	}

	task.output = `✅ ${normalizedCollections.length} collection(s) processadas, ${allUnresolved.length} relação(ões) não resolvida(s).`;

	return {
		...context,
		// Propaga splitCollections resolvido (nomes reais da API) para que
		// build-types caspasse as chaves de collectionTypes (também nomes reais).
		runtimeConfig: {
			...dataSource,
			splitCollections: configuredSplitCollections,
		},
		pipelineContext: {
			...pipelineCtx,
			collectionTypes,
		} satisfies GenerateTypesPipelineCtx,
	};
}
