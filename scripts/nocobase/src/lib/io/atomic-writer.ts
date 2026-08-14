import * as fs from "node:fs";
import * as path from "node:path";
import { writeCliError } from "@generators/lib/cli/cli-output";
import { runLinterFix } from "@generators/lib/validation/linter-runner";
import {
	validateTypeScriptDirectory,
	validateTypeScriptFiles,
} from "@generators/lib/validation/tsc-validator";

export interface ValidationTarget {
	files: string[];
	lintDirs: string[];
}

interface DiffResult {
	changedFiles: string[];
	unchangedFiles: string[];
	deletedFiles: string[];
}

interface ValidationOptions {
	validate?: boolean;
	lint?: boolean;
}

function listFilesRecursively(dir: string): string[] {
	const files: string[] = [];
	const entries = fs.readdirSync(dir, { withFileTypes: true });

	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...listFilesRecursively(fullPath));
		} else {
			files.push(fullPath);
		}
	}

	return files;
}

export function computeDiff(tempDir: string, outputDir: string): DiffResult {
	const changedFiles: string[] = [];
	const unchangedFiles: string[] = [];
	const deletedFiles: string[] = [];

	const tempFiles = listFilesRecursively(tempDir);
	const existingFiles = fs.existsSync(outputDir)
		? listFilesRecursively(outputDir)
		: [];

	const existingSet = new Set(
		existingFiles.map((f) => path.relative(outputDir, f)),
	);

	for (const tempFile of tempFiles) {
		const relativePath = path.relative(tempDir, tempFile);
		existingSet.delete(relativePath);

		const targetPath = path.join(outputDir, relativePath);
		const tempContent = fs.readFileSync(tempFile, "utf-8");

		if (fs.existsSync(targetPath)) {
			const existingContent = fs.readFileSync(targetPath, "utf-8");
			if (existingContent === tempContent) {
				unchangedFiles.push(relativePath);
				continue;
			}
		}

		changedFiles.push(relativePath);
	}

	// Files that exist in output but not in temp = deleted
	for (const relativePath of existingSet) {
		deletedFiles.push(relativePath);
	}

	return { changedFiles, unchangedFiles, deletedFiles };
}

export function backupDir(sourceDir: string, backupDirPath: string): void {
	if (!fs.existsSync(sourceDir)) return;
	fs.cpSync(sourceDir, backupDirPath, { recursive: true });
}

export function swapTempToOutput(tempDir: string, outputDir: string): void {
	const outputParent = path.dirname(outputDir);
	if (!fs.existsSync(outputParent)) {
		fs.mkdirSync(outputParent, { recursive: true });
	}

	// On Windows, fs.renameSync across directories frequently fails with EPERM
	// when any process (antivirus, file watcher, IDE) holds a handle on the
	// target path. Copy + remove is more reliable and keeps the same observable
	// behavior: outputDir receives temp contents and tempDir is deleted.
	if (fs.existsSync(outputDir)) {
		fs.rmSync(outputDir, { recursive: true, force: true });
	}

	fs.cpSync(tempDir, outputDir, { recursive: true, force: true });
	removeDir(tempDir);
}

export function removeDir(dir: string): void {
	if (fs.existsSync(dir)) {
		fs.rmSync(dir, { recursive: true, force: true });
	}
}

function isCoverageTempPath(dir: string): boolean {
	const parts = path.resolve(dir).split(path.sep);
	const tmpIndex = parts.lastIndexOf(".tmp");
	if (tmpIndex <= 0) {
		return false;
	}
	const parent = parts[tmpIndex - 1];
	return parent === "coverage";
}

export function cleanupTempSessionDir(tempDir: string): void {
	if (isCoverageTempPath(tempDir)) {
		return;
	}

	const tempRootDir = path.dirname(tempDir);
	// Never touch coverage folders (basename ".tmp") or unrelated temp roots.
	if (path.basename(tempRootDir) === ".tmp") {
		return;
	}

	removeDir(tempDir);

	if (path.basename(tempRootDir) !== ".temp") {
		return;
	}

	const resolvedRoot = path.resolve(tempRootDir);
	const allowedRoots = new Set([
		path.resolve(process.cwd(), ".temp"),
		path.resolve("/tmp", ".temp"),
	]);
	if (!allowedRoots.has(resolvedRoot)) {
		return;
	}

	if (!fs.existsSync(tempRootDir)) {
		return;
	}

	const tempRootEntries = fs.readdirSync(tempRootDir);
	if (tempRootEntries.length === 0) {
		removeDir(tempRootDir);
	}
}

export async function runValidation(
	target: string | ValidationTarget,
	options?: ValidationOptions,
): Promise<boolean> {
	const validate = options?.validate ?? true;
	const lint = options?.lint ?? true;

	if (validate) {
		const isValid =
			typeof target === "string"
				? await validateTypeScriptDirectory(target)
				: await validateTypeScriptFiles(target.files);
		if (!isValid) {
			writeCliError("❌ Validação TypeScript falhou.");
			return false;
		}
	}

	if (lint) {
		const lintDirs = typeof target === "string" ? [target] : target.lintDirs;
		if (lintDirs.length > 0) {
			await runLinterFix(lintDirs);
		}
	}

	return true;
}
