import type { PipelineExecutionContext } from "@generators/lib/pipeline/context";
import { addJsonReport } from "@generators/lib/pipeline/reports";
import type { TaskRunner } from "@shared/types";
import type { DataSourceGenerationConfig } from "../@types/script";
import type { GenerateTypesPipelineCtx } from "./fetch-schemas";

const I18N_TITLE_TEMPLATE_REGEX = /^\s*\{\{\s*t\(.+\)\s*\}\}\s*$/;

// ──────────────────────────────────────────────
// Stage: write-reports
// ──────────────────────────────────────────────

/**
 * Generates JSON reports with generation statistics.
 *
 * Reports:
 * - Collections processed count
 * - Files generated (changed vs unchanged)
 * - Unresolved relations (target collection not available)
 *
 * Uses addJsonReport() to store entries in the pipeline report context.
 * Does NOT write markdown — the pipeline lifecycle handles that.
 */
export async function writeReportsStage(
	context: PipelineExecutionContext<
		DataSourceGenerationConfig,
		GenerateTypesPipelineCtx
	>,
	task: TaskRunner,
): Promise<
	PipelineExecutionContext<DataSourceGenerationConfig, GenerateTypesPipelineCtx>
> {
	const { runtimeConfig: dataSource, reports } = context;
	const pipelineCtx = context.pipelineContext as
		| GenerateTypesPipelineCtx
		| undefined;

	if (!pipelineCtx) {
		throw new Error("write-reports: pipelineContext não encontrado.");
	}

	const dataSourceKey = dataSource.dataSource || dataSource.name;
	const now = new Date();

	task.output = "📊 Gerando relatórios...";

	// ── Report 1: Collections processed ──
	const collectionCount = pipelineCtx.collectionTypes
		? Object.keys(pipelineCtx.collectionTypes).length
		: 0;
	const mainCount = pipelineCtx.mainCollections
		? Object.keys(pipelineCtx.mainCollections).length
		: 0;
	const splitCount = pipelineCtx.splitCollections
		? pipelineCtx.splitCollections.size
		: 0;

	const collectionNames = pipelineCtx.collections
		? pipelineCtx.collections.map((c) => c.name).sort()
		: [];

	context.reports = addJsonReport(
		reports,
		{
			namespace: "generate-types",
			key: `collections-processed-${dataSourceKey}`,
			title: "Collections Processadas",
			scope: {
				pipeline: "generate-types",
				stage: "write-reports",
				dataSourceKey,
			},
			payload: {
				dataSource: dataSourceKey,
				totalCollections: collectionCount,
				mainCollections: mainCount,
				splitCollections: splitCount,
				collectionNames,
			},
		},
		now,
	);

	// ── Report 2: Files generated ──
	const fileCount = pipelineCtx.fileContents?.size ?? 0;
	const writeResults = pipelineCtx.writeResults ?? [];
	const changedFiles = writeResults.filter((r) => r.changed).length;
	const unchangedFiles = writeResults.filter((r) => !r.changed).length;
	const filePaths = writeResults.map((r) => r.outputPath).sort();

	context.reports = addJsonReport(
		reports,
		{
			namespace: "generate-types",
			key: `files-generated-${dataSourceKey}`,
			title: "Arquivos Gerados",
			scope: {
				pipeline: "generate-types",
				stage: "write-reports",
				dataSourceKey,
			},
			payload: {
				dataSource: dataSourceKey,
				totalFiles: fileCount,
				changedFiles,
				unchangedFiles,
				filePaths,
			},
		},
		now,
	);

	// ── Report 3: Unresolved relations ──
	const unresolvedRelations = pipelineCtx.unresolvedRelations ?? [];

	if (unresolvedRelations.length > 0) {
		// Group by collection
		const groupedByCollection: Record<string, string[]> = {};
		for (const rel of unresolvedRelations) {
			const existing = groupedByCollection[rel.collection] ?? [];
			existing.push(`${rel.field} → ${rel.target}`);
			groupedByCollection[rel.collection] = existing;
		}

		context.reports = addJsonReport(
			reports,
			{
				namespace: "generate-types",
				key: `unresolved-relations-${dataSourceKey}`,
				title: "Relações Não Resolvidas",
				scope: {
					pipeline: "generate-types",
					stage: "write-reports",
					dataSourceKey,
				},
				payload: {
					dataSource: dataSourceKey,
					totalUnresolved: unresolvedRelations.length,
					relationsByCollection: groupedByCollection,
				},
			},
			now,
		);

		task.output = `⚠️ ${unresolvedRelations.length} relação(ões) não resolvida(s)`;
	} else {
		context.reports = addJsonReport(
			reports,
			{
				namespace: "generate-types",
				key: `unresolved-relations-${dataSourceKey}`,
				title: "Relações Não Resolvidas",
				scope: {
					pipeline: "generate-types",
					stage: "write-reports",
					dataSourceKey,
				},
				payload: {
					dataSource: dataSourceKey,
					totalUnresolved: 0,
					message: "Todas as relações foram resolvidas com sucesso.",
				},
			},
			now,
		);

		task.output = "✅ Todas as relações resolvidas.";
	}

	// ── Report 4: Split collection status ──
	if (pipelineCtx.mainCollections) {
		const nonSplitNames = Object.keys(pipelineCtx.mainCollections).sort();

		context.reports = addJsonReport(
			reports,
			{
				namespace: "generate-types",
				key: `split-status-${dataSourceKey}`,
				title: "Status de Collections Split",
				scope: {
					pipeline: "generate-types",
					stage: "write-reports",
					dataSourceKey,
				},
				payload: {
					dataSource: dataSourceKey,
					totalNonSplit: nonSplitNames.length,
					nonSplitCollectionNames: nonSplitNames,
				},
			},
			now,
		);
	}

	// ── Report 5: Fields with i18n title template ──
	const i18nFieldsMap = new Map<
		string,
		{ fieldName: string; labelTemplate: string; collections: Set<string> }
	>();
	const collectionEntries = Object.entries(pipelineCtx.collectionTypes ?? {});
	for (const [collectionName, generatedTypes] of collectionEntries) {
		for (const [
			fieldName,
			fieldLabel,
		] of generatedTypes.fieldLabels.entries()) {
			if (!I18N_TITLE_TEMPLATE_REGEX.test(fieldLabel)) {
				continue;
			}

			const dedupeKey = `${fieldName}::${fieldLabel}`;
			const current = i18nFieldsMap.get(dedupeKey);
			if (current) {
				current.collections.add(collectionName);
				continue;
			}

			i18nFieldsMap.set(dedupeKey, {
				fieldName,
				labelTemplate: fieldLabel,
				collections: new Set([collectionName]),
			});
		}
	}

	const uniqueI18nFields = Array.from(i18nFieldsMap.values())
		.map((entry) => ({
			fieldName: entry.fieldName,
			labelTemplate: entry.labelTemplate,
			collections: Array.from(entry.collections).sort(),
			collectionCount: entry.collections.size,
		}))
		.sort((a, b) => {
			const byField = a.fieldName.localeCompare(b.fieldName);
			if (byField !== 0) return byField;
			return a.labelTemplate.localeCompare(b.labelTemplate);
		});

	context.reports = addJsonReport(
		context.reports,
		{
			namespace: "generate-types",
			key: `i18n-title-template-fields-${dataSourceKey}`,
			title: "Campos com Title I18n Template",
			scope: {
				pipeline: "generate-types",
				stage: "write-reports",
				dataSourceKey,
			},
			payload: {
				dataSource: dataSourceKey,
				totalUniqueFields: uniqueI18nFields.length,
				fields: uniqueI18nFields,
			},
		},
		now,
	);

	// ── Report 6: Collection content summaries ──
	for (const [collectionName, generated] of Object.entries(
		pipelineCtx.collectionTypes ?? {},
	).sort(([a], [b]) => a.localeCompare(b))) {
		context.reports = addJsonReport(
			context.reports,
			{
				namespace: "generate-types",
				key: `collection-content-${dataSourceKey}-${collectionName}`,
				title: "Conteúdo da Collection",
				scope: {
					pipeline: "generate-types",
					stage: "write-reports",
					dataSourceKey,
				},
				payload: {
					dataSource: dataSourceKey,
					collectionName,
					scalarFieldCount: generated.scalars.size,
					relationFieldCount: generated.relations.size,
					enumFieldCount: generated.enums.size,
					fieldLabelCount: generated.fieldLabels.size,
					scalarFieldNames: Array.from(generated.scalars.keys()).sort(),
					relationFieldNames: Array.from(generated.relations.keys()).sort(),
					enumFieldNames: Array.from(generated.enums.keys()).sort(),
				},
			},
			now,
		);
	}

	return {
		...context,
		reports: context.reports,
		pipelineContext: pipelineCtx satisfies GenerateTypesPipelineCtx,
	};
}
