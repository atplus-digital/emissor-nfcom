import * as fs from "node:fs";
import * as path from "node:path";
import { writeCliWarning } from "@generators/cli/cli-output";

/**
 * Diff de diagnóstico entre a saída recém-gerada (temp) e a saída vigente
 * (output). Ativado pela flag `--diff-debug`.
 *
 * Para cada arquivo alterado, gera um diff unificado (formato @@ ... @@)
 * apontando as linhas exatas que diferem. Ajuda a localizar a fonte de
 * não-determinismo quando o pipeline reporta mudança entre gerações
 * consecutivas com a mesma entrada.
 *
 * Saída: arquivo `.reports/generate-types/diff-debug.txt` + resumo no stderr.
 */

const MAX_CONTEXT_LINES = 3;
const MAX_DIFF_LINES = 40;

interface Hunk {
	oldStart: number;
	oldLen: number;
	newStart: number;
	newLen: number;
	lines: string[];
}

function splitLines(content: string): string[] {
	// Mantém consistência com o conteúdo lido do disco (split por \n).
	return content.length === 0 ? [] : content.split("\n");
}

/**
 * Diff unificado linha-a-linha via LCS (longest common subsequence).
 * Implementação compacta suficiente para arquivos gerados (não é O(N²)
 * crítico aqui — os arquivos têm até poucas centenas de linhas).
 */
function computeUnifiedDiff(oldContent: string, newContent: string): string[] {
	const oldLines = splitLines(oldContent);
	const newLines = splitLines(newContent);

	const m = oldLines.length;
	const n = newLines.length;

	// Tabela LCS
	const dp: number[][] = Array.from({ length: m + 1 }, () =>
		new Array<number>(n + 1).fill(0),
	);
	for (let i = m - 1; i >= 0; i--) {
		for (let j = n - 1; j >= 0; j--) {
			const row = dp[i]!;
			const nextRow = dp[i + 1]!;
			row[j] =
				oldLines[i] === newLines[j]
					? nextRow[j + 1]! + 1
					: Math.max(nextRow[j]!, row[j + 1]!);
		}
	}

	// Backtracking montando a sequência de operações
	type Op = { type: "eq" | "del" | "add"; line: string };
	const ops: Op[] = [];
	let i = 0;
	let j = 0;
	while (i < m && j < n) {
		const oldLine = oldLines[i]!;
		const newLine = newLines[j]!;
		if (oldLine === newLine) {
			ops.push({ type: "eq", line: oldLine });
			i++;
			j++;
		} else if ((dp[i + 1]?.[j] ?? 0) >= (dp[i]?.[j + 1] ?? 0)) {
			ops.push({ type: "del", line: oldLine });
			i++;
		} else {
			ops.push({ type: "add", line: newLine });
			j++;
		}
	}
	while (i < m) {
		ops.push({ type: "del", line: oldLines[i++]! });
	}
	while (j < n) {
		ops.push({ type: "add", line: newLines[j++]! });
	}

	// Agrupa em hunks com contexto
	const hunks: Hunk[] = [];
	let current: Hunk | null = null;
	let oldIdx = 0;
	let newIdx = 0;

	const flush = (): void => {
		if (current && current.lines.length > 0) {
			hunks.push(current);
		}
		current = null;
	};

	for (const op of ops) {
		if (op.type === "eq") {
			if (current) {
				current.lines.push(` ${op.line}`);
				current.oldLen++;
				current.newLen++;
				// Fecha o hunk após contexto suficiente sem mudanças
				const lastChangeIndex = [...current.lines]
					.reverse()
					.findIndex((l) => l.startsWith("+") || l.startsWith("-"));
				if (lastChangeIndex === -1 || lastChangeIndex >= MAX_CONTEXT_LINES) {
					flush();
				}
			}
			oldIdx++;
			newIdx++;
		} else {
			if (!current) {
				const ctxStart = Math.max(0, oldIdx - MAX_CONTEXT_LINES);
				current = {
					oldStart: ctxStart + 1,
					oldLen: oldIdx - ctxStart,
					newStart: Math.max(0, newIdx - MAX_CONTEXT_LINES) + 1,
					newLen: newIdx - Math.max(0, newIdx - MAX_CONTEXT_LINES),
					lines: [],
				};
				// linhas de contexto pré-mudança
				for (let k = ctxStart; k < oldIdx; k++) {
					current.lines.push(` ${oldLines[k]!}`);
				}
			}
			if (op.type === "del") {
				current.lines.push(`-${op.line}`);
				current.oldLen++;
			} else {
				current.lines.push(`+${op.line}`);
				current.newLen++;
			}
			if (op.type === "del") oldIdx++;
			else newIdx++;
		}
	}
	flush();

	// Monta o texto do diff
	const out: string[] = [];
	for (const h of hunks) {
		out.push(`@@ -${h.oldStart},${h.oldLen} +${h.newStart},${h.newLen} @@`);
		out.push(...h.lines);
	}
	return out;
}

interface DiffDebugFile {
	relativePath: string;
	reason: "changed" | "added" | "deleted";
	diffLines: string[];
}

function collectDiffDebug(tempDir: string, outputDir: string): DiffDebugFile[] {
	const results: DiffDebugFile[] = [];
	if (!fs.existsSync(tempDir)) {
		return results;
	}

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

		if (!fs.existsSync(targetPath)) {
			results.push({
				relativePath,
				reason: "added",
				diffLines: ["(arquivo novo no temp, sem correspondente no output)"],
			});
			continue;
		}

		const existingContent = fs.readFileSync(targetPath, "utf-8");
		if (existingContent === tempContent) {
			continue;
		}

		results.push({
			relativePath,
			reason: "changed",
			diffLines: computeUnifiedDiff(existingContent, tempContent),
		});
	}

	for (const relativePath of existingSet) {
		results.push({
			relativePath,
			reason: "deleted",
			diffLines: ["(arquivo no output, removido do temp)"],
		});
	}

	return results;
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

export interface DiffDebugSummary {
	totalFiles: number;
	byReason: Record<string, number>;
	reportPath: string;
}

/**
 * Gera e escreve o diff de diagnóstico para um conjunto de pares temp/output.
 * Retorna um resumo com contagens.
 */
export function writeDiffDebug(
	pairs: Array<{ tempDir: string; outputDir: string; label: string }>,
	reportsDir: string,
): DiffDebugSummary {
	const allFiles: Array<DiffDebugFile & { label: string }> = [];

	for (const { tempDir, outputDir, label } of pairs) {
		const files = collectDiffDebug(tempDir, outputDir);
		for (const f of files) {
			allFiles.push({ ...f, label });
		}
	}

	if (allFiles.length === 0) {
		writeCliWarning(
			"diff-debug: nenhuma diferença detectada entre temp e output.",
		);
	}

	const reportPath = path.join(reportsDir, "diff-debug.txt");
	fs.mkdirSync(reportsDir, { recursive: true });

	const lines: string[] = [
		"# Diff de diagnóstico — temp vs output",
		"# Gerado por --diff-debug",
		"",
	];

	for (const f of allFiles) {
		lines.push(`=== [${f.label}] ${f.relativePath} (${f.reason}) ===`);
		const shown = f.diffLines.slice(0, MAX_DIFF_LINES);
		lines.push(...shown);
		if (f.diffLines.length > MAX_DIFF_LINES) {
			lines.push(
				`... (+${f.diffLines.length - MAX_DIFF_LINES} linhas omitidas)`,
			);
		}
		lines.push("");
	}

	fs.writeFileSync(reportPath, lines.join("\n"), "utf-8");

	const byReason: Record<string, number> = {};
	for (const f of allFiles) {
		byReason[f.reason] = (byReason[f.reason] ?? 0) + 1;
	}

	writeCliWarning(
		`diff-debug: ${allFiles.length} arquivo(s) com diferença → ${reportPath}`,
	);
	for (const [reason, count] of Object.entries(byReason).sort()) {
		writeCliWarning(`  ${reason}: ${count}`);
	}

	return {
		totalFiles: allFiles.length,
		byReason,
		reportPath,
	};
}
