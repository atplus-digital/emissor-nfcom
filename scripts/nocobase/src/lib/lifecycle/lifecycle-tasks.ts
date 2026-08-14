import * as fs from "node:fs";
import * as path from "node:path";
import {
	backupDir,
	cleanupTempSessionDir,
	computeDiff,
	runValidation,
	swapTempToOutput,
	type ValidationTarget,
} from "@generators/lib/io/atomic-writer";
import {
	countReports,
	type PipelineReportsContext,
	renderReportsMarkdown,
} from "@generators/lib/pipeline/reports";
import { writeDiffDebug } from "@generators/lib/io/diff-debug";
import { listTypeScriptFilesInDirectory } from "@generators/lib/validation/tsc-validator";
import { isDiffDebug } from "@generators/lib/validation/diff-debug-options";
import { isValidationSkipped } from "@generators/lib/validation/validation-options";
import type { TaskRunner } from "@shared/types";
import type { PipelineExecutionContext } from "../pipeline/context";

interface DiffSummary {
	changedFiles: string[];
	unchangedFiles: string[];
	deletedFiles: string[];
}

// ──────────────────────────────────────────────
// Shared types
// ──────────────────────────────────────────────

export interface LifecycleCtx {
	diffs?: DiffSummary[];
	hasChanges: boolean;
}

export interface PipelineJsonReportResult {
	label: string;
	hasChanges: boolean;
	reports: PipelineReportsContext;
}

// ──────────────────────────────────────────────
// Task parameters — collected once and passed through
// ──────────────────────────────────────────────

export interface LifecycleTaskParams<
	TRuntimeConfig,
	TPipelineContext = unknown,
> {
	tempDir: string;
	outputDirs: string[];
	context: PipelineExecutionContext<TRuntimeConfig, TPipelineContext>;
	label: string;
	reportsOutputPath?: string;
	task: TaskRunner;
	cwd: string;
	timestamp: number;
	randomId: string;
	onReportReady?: (result: PipelineJsonReportResult) => void;
}

function persistPipelineReport(
	params: LifecycleTaskParams<unknown, unknown>,
	hasChanges: boolean,
): void {
	params.onReportReady?.({
		label: params.label,
		hasChanges,
		reports: params.context.reports,
	});

	if (!params.reportsOutputPath) return;

	const reportMd = renderReportsMarkdown(params.context.reports, {
		title: `Relatório — ${params.label}`,
	});
	fs.mkdirSync(path.dirname(params.reportsOutputPath), {
		recursive: true,
	});
	fs.writeFileSync(params.reportsOutputPath, reportMd, "utf-8");
}

function formatDiffTaskOutput(
	diffs: DiffSummary[],
	totalReports: number,
): string {
	const totalChanged = diffs.reduce((sum, d) => sum + d.changedFiles.length, 0);
	const totalDeleted = diffs.reduce((sum, d) => sum + d.deletedFiles.length, 0);
	const totalUnchanged = diffs.reduce(
		(sum, d) => sum + d.unchangedFiles.length,
		0,
	);

	const parts: string[] = [];
	if (totalChanged > 0) parts.push(`${totalChanged} alterado(s)`);
	if (totalDeleted > 0) parts.push(`${totalDeleted} removido(s)`);
	if (totalUnchanged > 0) parts.push(`${totalUnchanged} inalterado(s)`);
	parts.push(`${totalReports} report(s)`);

	return parts.join(", ");
}

// ──────────────────────────────────────────────
// Task functions
// ──────────────────────────────────────────────

/** Task 3 — Validate generated output (after diff, only when changes exist) */
function collectValidationPlan(
	ctx: LifecycleCtx,
	params: LifecycleTaskParams<unknown, unknown>,
): ValidationTarget | null {
	if (!ctx.hasChanges || !ctx.diffs) {
		return null;
	}

	const files: string[] = [];
	const lintDirs: string[] = [];

	for (let index = 0; index < params.outputDirs.length; index += 1) {
		const outputDir = params.outputDirs[index];
		const diff = ctx.diffs[index];
		if (!outputDir || !diff) {
			continue;
		}

		const hasFileChanges =
			diff.changedFiles.length > 0 || diff.deletedFiles.length > 0;
		if (!hasFileChanges) {
			continue;
		}

		const tempOutputDir = path.join(params.tempDir, outputDir);
		if (!fs.existsSync(tempOutputDir)) {
			continue;
		}

		lintDirs.push(tempOutputDir);

		if (diff.deletedFiles.length > 0) {
			files.push(...listTypeScriptFilesInDirectory(tempOutputDir));
			continue;
		}

		for (const relativeFile of diff.changedFiles) {
			const fullPath = path.join(tempOutputDir, relativeFile);
			if (fullPath.endsWith(".ts") || fullPath.endsWith(".d.ts")) {
				files.push(fullPath);
			}
		}
	}

	if (files.length === 0) {
		return lintDirs.length > 0 ? { files: [], lintDirs } : null;
	}

	return {
		files: Array.from(new Set(files)),
		lintDirs: Array.from(new Set(lintDirs)),
	};
}

export async function validateGeneratedOutput(
	ctx: LifecycleCtx,
	params: LifecycleTaskParams<unknown, unknown>,
): Promise<void> {
	if (isValidationSkipped() || !ctx.hasChanges) {
		return;
	}

	const plan = collectValidationPlan(ctx, params);
	if (!plan) {
		return;
	}

	const isValid = await runValidation(plan);
	if (!isValid) {
		cleanupTempSessionDir(params.tempDir);
		throw new Error(
			"Validação falhou para a saída gerada. Alterações descartadas.",
		);
	}
}

/** Task 3 — Diff temp vs output */
export async function diffTempVsOutput(
	ctx: LifecycleCtx,
	params: LifecycleTaskParams<unknown, unknown>,
): Promise<void> {
	const diffs: DiffSummary[] = [];
	let hasChanges = false;

	for (const outputDir of params.outputDirs) {
		const tempOutputDir = path.join(params.tempDir, outputDir);
		const resolvedOutputDir = path.resolve(outputDir);

		if (!fs.existsSync(tempOutputDir)) {
			diffs.push({
				changedFiles: [],
				unchangedFiles: [],
				deletedFiles: [],
			});
			continue;
		}

		const diffResult = computeDiff(tempOutputDir, resolvedOutputDir);
		diffs.push(diffResult);

		if (
			diffResult.changedFiles.length > 0 ||
			diffResult.deletedFiles.length > 0
		) {
			hasChanges = true;
		}
	}

	ctx.diffs = diffs;
	ctx.hasChanges = hasChanges;

	// Modo de diagnóstico: gera diff unificado por arquivo para localizar
	// não-determinismo quando há mudança entre gerações consecutivas.
	if (hasChanges && isDiffDebug()) {
		const pairs: Array<{
			tempDir: string;
			outputDir: string;
			label: string;
		}> = [];
		for (const outputDir of params.outputDirs) {
			const tempOutputDir = path.join(params.tempDir, outputDir);
			const resolvedOutputDir = path.resolve(outputDir);
			if (fs.existsSync(tempOutputDir)) {
				pairs.push({
					tempDir: tempOutputDir,
					outputDir: resolvedOutputDir,
					label: outputDir,
				});
			}
		}
		const reportsDir = path.join(params.cwd, ".reports", "generate-types");
		writeDiffDebug(pairs, reportsDir);
	}
}

/** Task 4 — No changes: cleanup and render reports */
export async function handleNoChanges(
	ctx: LifecycleCtx,
	params: LifecycleTaskParams<unknown, unknown>,
): Promise<void> {
	cleanupTempSessionDir(params.tempDir);

	persistPipelineReport(params, false);

	const totalReports = countReports(params.context.reports);
	const totalUnchanged = (ctx.diffs ?? []).reduce(
		(sum, d) => sum + d.unchangedFiles.length,
		0,
	);

	params.task.output = `Sem alterações. ${totalUnchanged} inalterado(s), ${totalReports} report(s).`;
}

/** Task 5 — Backup current output */
export async function backupCurrentOutput(
	params: LifecycleTaskParams<unknown, unknown>,
): Promise<void> {
	const backupId = `${params.timestamp}-${params.randomId}`;
	const backupRootDir = path.join(params.cwd, ".backup", backupId);
	for (const outputDir of params.outputDirs) {
		const resolvedOutputDir = path.resolve(outputDir);
		const relativeOutputDir = path.relative(params.cwd, resolvedOutputDir);
		const backupPath = path.join(backupRootDir, relativeOutputDir);
		fs.mkdirSync(path.dirname(backupPath), {
			recursive: true,
		});
		backupDir(resolvedOutputDir, backupPath);
	}
}

/** Task 6 — Swap temp → output */
export async function swapTempToOutputDirs(
	params: LifecycleTaskParams<unknown, unknown>,
): Promise<void> {
	for (const outputDir of params.outputDirs) {
		const tempOutputDir = path.join(params.tempDir, outputDir);
		const resolvedOutputDir = path.resolve(outputDir);

		if (!fs.existsSync(tempOutputDir)) continue;
		swapTempToOutput(tempOutputDir, resolvedOutputDir);
	}

	cleanupTempSessionDir(params.tempDir);
}

/** Task 7 — Render reports + summary */
export async function renderReportsSummary(
	ctx: LifecycleCtx,
	params: LifecycleTaskParams<unknown, unknown>,
): Promise<void> {
	persistPipelineReport(params, true);

	const diffs = ctx.diffs ?? [];
	const totalReports = countReports(params.context.reports);
	params.task.output = formatDiffTaskOutput(diffs, totalReports);
}
