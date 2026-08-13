import * as fs from "node:fs";
import * as path from "node:path";
import type { PipelineExecutionContext } from "@generators/lib/pipeline/context";
import type { TaskRunner } from "@shared/types";
import type { DataSourceGenerationConfig } from "../@types/script";
import type {
	GenerateFileWrite,
	GenerateTypesPipelineCtx,
} from "./fetch-schemas";

// ──────────────────────────────────────────────
// Stage: write-files
// ──────────────────────────────────────────────

/**
 * Writes generated files to disk.
 *
 * 1. Takes fileContents from pipelineContext (produced by generate-content stage).
 * 2. Resolves the output directory from dataSource config or context.tempDir.
 * 3. Creates directories as needed.
 * 4. Writes each file using fs.writeFileSync.
 * 5. Tracks write results (changed, skipped).
 */
export async function writeFilesStage(
	context: PipelineExecutionContext<
		DataSourceGenerationConfig,
		GenerateTypesPipelineCtx
	>,
	task: TaskRunner,
): Promise<
	PipelineExecutionContext<DataSourceGenerationConfig, GenerateTypesPipelineCtx>
> {
	const { runtimeConfig: dataSource, tempDir } = context;
	const pipelineCtx = context.pipelineContext as
		| GenerateTypesPipelineCtx
		| undefined;

	if (!pipelineCtx?.fileContents || pipelineCtx.fileContents.size === 0) {
		throw new Error(
			"write-files: fileContents não encontrado ou vazio em pipelineContext. " +
				"O estágio generate-content deve ser executado antes.",
		);
	}

	// Resolve output directory: use dataSource.outputDir or derive from tempDir
	const outputDir = dataSource.outputDir
		? path.resolve(process.cwd(), dataSource.outputDir)
		: path.join(tempDir, dataSource.dataSource || dataSource.name);

	task.output = `💾 Escrevendo ${pipelineCtx.fileContents.size} arquivo(s) em '${path.relative(process.cwd(), outputDir)}'...`;

	const writeResults: GenerateFileWrite[] = [];

	const totalFiles = pipelineCtx.fileContents.size;
	let processed = 0;

	for (const [relativePath, content] of pipelineCtx.fileContents.entries()) {
		processed += 1;
		if (processed === 1 || processed % 200 === 0 || processed === totalFiles) {
			task.output = `💾 Escrevendo arquivos [${processed}/${totalFiles}] em '${path.relative(process.cwd(), outputDir)}'...`;
		}

		const fullPath = path.join(outputDir, relativePath);
		const directoryPath = path.dirname(fullPath);

		// Create directory if it doesn't exist
		if (!fs.existsSync(directoryPath)) {
			fs.mkdirSync(directoryPath, { recursive: true });
		}

		// Check if file content changed
		let currentContent = "";
		try {
			currentContent = fs.readFileSync(fullPath, "utf-8");
		} catch {
			// File doesn't exist yet
		}

		if (currentContent === content) {
			// File unchanged — skip writing
			writeResults.push({
				outputPath: path.relative(process.cwd(), fullPath),
				changed: false,
				skipped: false,
			});
			continue;
		}

		// Write the file
		fs.writeFileSync(fullPath, content, "utf-8");

		writeResults.push({
			outputPath: path.relative(process.cwd(), fullPath),
			changed: true,
		});
	}

	const changedCount = writeResults.filter((r) => r.changed).length;
	const unchangedCount = writeResults.filter((r) => !r.changed).length;

	task.output = `📊 ${changedCount} alterado(s), ${unchangedCount} inalterado(s) de ${writeResults.length} total`;

	return {
		...context,
		pipelineContext: {
			...pipelineCtx,
			writeResults,
		} satisfies GenerateTypesPipelineCtx,
	};
}
