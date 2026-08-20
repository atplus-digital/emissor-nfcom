import * as fs from "node:fs";
import * as path from "node:path";
import { isDiffDebug, isValidationSkipped } from "@generators/cli/flags";
import {
	cleanupTempSessionDir,
	computeDiff,
	type DiffResult,
	runValidation,
	swapTempToOutput,
	type ValidationTarget,
} from "@generators/io/atomic-writer";
import { writeDiffDebug } from "@generators/io/diff-debug";
import type { TaskRunner } from "@generators/types";
import { listTypeScriptFilesInDirectory } from "@generators/validation/tsc-validator";

// ──────────────────────────────────────────────
// Shared types
// ──────────────────────────────────────────────

export interface LifecycleCtx {
	diffs?: DiffResult[];
	hasChanges: boolean;
}

// ──────────────────────────────────────────────
// Task parameters — collected once and passed through
// ──────────────────────────────────────────────

export interface LifecycleTaskParams {
	tempDir: string;
	outputDirs: string[];
	task: TaskRunner;
	cwd: string;
}

function formatDiffTaskOutput(diffs: DiffResult[]): string {
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

	return parts.join(", ");
}

// ──────────────────────────────────────────────
// Task functions
// ──────────────────────────────────────────────

/** Task 3 — Validate generated output (after diff, only when changes exist) */
function collectValidationPlan(
	ctx: LifecycleCtx,
	params: LifecycleTaskParams,
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
	params: LifecycleTaskParams,
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
	params: LifecycleTaskParams,
): Promise<void> {
	const diffs: DiffResult[] = [];
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

/** Task 4 — No changes: cleanup and summarize */
export async function handleNoChanges(
	ctx: LifecycleCtx,
	params: LifecycleTaskParams,
): Promise<void> {
	cleanupTempSessionDir(params.tempDir);

	const totalUnchanged = (ctx.diffs ?? []).reduce(
		(sum, d) => sum + d.unchangedFiles.length,
		0,
	);

	params.task.output = `Sem alterações. ${totalUnchanged} inalterado(s).`;
}

/** Task 6 — Swap temp → output */
export async function swapTempToOutputDirs(
	params: LifecycleTaskParams,
): Promise<void> {
	for (const outputDir of params.outputDirs) {
		const tempOutputDir = path.join(params.tempDir, outputDir);
		const resolvedOutputDir = path.resolve(outputDir);

		if (!fs.existsSync(tempOutputDir)) continue;
		swapTempToOutput(tempOutputDir, resolvedOutputDir);
	}

	cleanupTempSessionDir(params.tempDir);
}

/** Task 7 — Render diff summary */
export async function renderDiffSummary(
	ctx: LifecycleCtx,
	params: LifecycleTaskParams,
): Promise<void> {
	params.task.output = formatDiffTaskOutput(ctx.diffs ?? []);
}
