import * as path from "node:path";
import { NocoBaseApiClient } from "@generators/http/nocobase-client";
import type { PipelineExecutionContext } from "@generators/pipeline/context";
import {
	type AsyncPipelineStage,
	runPipelineStages,
} from "@generators/pipeline/runner";
import type { GeneratorPipeline } from "@generators/pipeline/types";
import type { TaskRunner } from "@generators/types";
import { resolveNocoBaseEnv } from "@generators/utils/env";
import { dataSourceConfigs } from "../../config/datasources";
import { buildTypes } from "./stages/build-types";
import type { GenerateTypesStageCtx } from "./stages/fetch-schemas";
import { fetchSchemas } from "./stages/fetch-schemas";
import { generateContentStage } from "./stages/generate-content";
import { writeFilesStage } from "./stages/write-files";
import { toDataSourceOutputFolder } from "./utils/output-folder";

// ──────────────────────────────────────────────
// Pipeline definition
// ──────────────────────────────────────────────

type TypesStage = AsyncPipelineStage<GenerateTypesStageCtx>;

/**
 * Top stage: fans out to one concurrent sub-pipeline per data source
 * (fetch → build → content → write-to-temp).
 */
function generateTypes(
	context: PipelineExecutionContext,
	lifecycleTask: TaskRunner,
) {
	const env = resolveNocoBaseEnv();
	const client = new NocoBaseApiClient(
		{
			baseUrl: env.baseUrl,
			token: env.token,
			timeoutMs: env.timeoutMs,
		},
		env.requestHeaders ? { requestHeaders: env.requestHeaders } : undefined,
	);

	return lifecycleTask.newListr(
		dataSourceConfigs.map((dataSource) => ({
			title: `📦 ${dataSource.name}`,
			task: (_listrCtx: unknown, dataSourceTask: TaskRunner) => {
				const outputDirRelative = `packages/generated/types/${toDataSourceOutputFolder(dataSource.dataSource)}/`;

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

				const dataSourceContext: GenerateTypesStageCtx = {
					...context,
					runtimeConfig: {
						...dataSource,
						outputDir: outputDirRelative,
					},
					pipelineContext: {
						client,
						dataSource,
						relations: dataSource.relationsMapping ?? {},
					},
				};

				return runPipelineStages(
					dataSourceContext,
					[
						fetchSchemas,
						buildTypes,
						generateContentStage,
						writeFilesToTempStage,
					],
					dataSourceTask,
				);
			},
		})),
		{
			concurrent: true,
		},
	);
}

export const generateTypesPipeline: GeneratorPipeline = {
	name: "generate-types",
	description: "Generate TypeScript types from NocoBase and IXC schemas",
	flag: "--types",
	runInDefault: true,
	outputDirs: dataSourceConfigs.map(
		(dataSource) =>
			`packages/generated/types/${toDataSourceOutputFolder(dataSource.dataSource)}/`,
	),
	buildStages: () => [generateTypes],
};
