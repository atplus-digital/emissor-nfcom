import * as path from "node:path";
import { runStandardPipeline } from "@generators/lib/lifecycle/lifecycle";
import type { PipelineExecutionContext } from "@generators/lib/pipeline/context";
import {
	type AsyncPipelineStage,
	runPipelineStages,
} from "@generators/lib/pipeline/runner";
import { toDataSourceOutputFolder } from "@generators/lib/utils/path-utils";
import { NocoBaseApiClient } from "@shared/http/nocobase-client";
import type { OrchestrationTaskRunner } from "@shared/types";
import { resolveNocoBaseEnv } from "@shared/utils/env";
import type { ListrTaskResult } from "listr2";
import { dataSourceConfigs } from "../../../config/datasources";
import type { RunGeneratorCliOptions } from "../../lib/pipeline/create-script-definition";
import type {
	DataSourceClient,
	DataSourceCollection,
	DataSourceGenerationConfig,
} from "./@types/script";
import { buildTypes } from "./stages/build-types";
import type { GenerateTypesPipelineCtx } from "./stages/fetch-schemas";
import { fetchSchemas } from "./stages/fetch-schemas";
import { generateContentStage } from "./stages/generate-content";
import { writeFilesStage } from "./stages/write-files";
import { writeReportsStage } from "./stages/write-reports";

// ──────────────────────────────────────────────
// Reports output directory
// ──────────────────────────────────────────────

const REPORTS_OUTPUT = ".reports/generate-types/report.md";

// ──────────────────────────────────────────────
// DataSource client factory (composition over NocoBaseApiClient)
// ──────────────────────────────────────────────

class NocoBaseDataSourceClient extends NocoBaseApiClient {
	public constructor(baseUrl: string, token: string, timeoutMs: number) {
		super({ baseUrl, token, timeoutMs });
	}

	/**
	 * Fetch collections with fields from the data source API.
	 * Public accessor for the protected fetchCollections method.
	 */
	public async fetchDataSourceCollections(
		dataSourceKey: string,
	): Promise<DataSourceCollection[]> {
		return this.fetchCollections(dataSourceKey) as Promise<
			DataSourceCollection[]
		>;
	}
}

function createDataSourceClient(credentials: {
	baseUrl: string;
	token: string;
	timeoutMs: number;
}): DataSourceClient {
	const inner = new NocoBaseDataSourceClient(
		credentials.baseUrl,
		credentials.token,
		credentials.timeoutMs,
	);

	return {
		get baseUrl() {
			return inner.baseUrl;
		},
		async fetchCollections(dataSourceKey: string) {
			return inner.fetchDataSourceCollections(dataSourceKey);
		},
	};
}

// ──────────────────────────────────────────────
// Pipeline definition
// ──────────────────────────────────────────────

type TypesCtx = PipelineExecutionContext<
	DataSourceGenerationConfig,
	GenerateTypesPipelineCtx
>;

type TypesStage = AsyncPipelineStage<TypesCtx>;

/**
 * Creates a Listr2 task tree for the generate-types pipeline.
 */
export function createGenerateTypesPipeline(): RunGeneratorCliOptions<object> {
	const outputDirs = dataSourceConfigs.map(
		(dataSource) =>
			`src/generated/types/${toDataSourceOutputFolder(dataSource.dataSource)}/`,
	);

	return {
		name: "generate-types",
		reportsOutputPath: REPORTS_OUTPUT,
		stages: [
			{
				title: "📦 Generate Types",
				run: (
					_ctx: object,
					task?: OrchestrationTaskRunner,
				): ListrTaskResult<unknown> => {
					if (!task) {
						throw new Error(
							"generate-types: task wrapper não fornecido pelo Listr2",
						);
					}

					const env = resolveNocoBaseEnv();
					const client = createDataSourceClient({
						baseUrl: env.baseUrl,
						token: env.token,
						timeoutMs: env.timeoutMs,
					});

					const executeAllDataSourcesStage: AsyncPipelineStage<
						PipelineExecutionContext<Record<string, never>, unknown>
					> = function executeAllDataSourcesStage(context, lifecycleTask) {
						return lifecycleTask.newListr(
							dataSourceConfigs.map((dataSource) => ({
								title: `📦 ${dataSource.name}`,
								task: (_listrCtx, dataSourceTask) => {
									const outputDirRelative = `src/generated/types/${toDataSourceOutputFolder(dataSource.dataSource)}/`;

									const writeFilesToTempStage: TypesStage =
										async function writeFilesToTempStage(stageCtx, writeTask) {
											const tempOutputDir = path.join(
												stageCtx.tempDir,
												outputDirRelative,
											);
											const patchedConfig = {
												...stageCtx.runtimeConfig,
												outputDir: tempOutputDir,
											};

											return writeFilesStage(
												{
													...stageCtx,
													runtimeConfig: patchedConfig,
												},
												writeTask,
											);
										};

									const dataSourceContext: TypesCtx = {
										...context,
										runtimeConfig: {
											...dataSource,
											outputDir: outputDirRelative,
										},
										pipelineContext: {
											client,
											dataSource,
										} as GenerateTypesPipelineCtx,
									};

									return runPipelineStages(
										dataSourceContext,
										[
											fetchSchemas,
											buildTypes,
											generateContentStage,
											writeFilesToTempStage,
											writeReportsStage,
										],
										dataSourceTask,
									);
								},
							})),
							{
								concurrent: true,
							},
						);
					};

					return runStandardPipeline<Record<string, never>, unknown>({
						task,
						defaultConfig: {},
						getOutputDirs: () => outputDirs,
						label: "generate-types",
						reportsOutputPath: REPORTS_OUTPUT,
						stages: [executeAllDataSourcesStage],
					});
				},
			},
		],
		context: {},
	};
}
