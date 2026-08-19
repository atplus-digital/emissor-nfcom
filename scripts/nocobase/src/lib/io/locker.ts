import * as fs from "node:fs";
import * as path from "node:path";
import { writeCliWarning } from "@generators/lib/cli/cli-output";
import { formatErrorMessage } from "@generators/lib/cli/format-error";

interface VSCodeSettings {
	[setting: string]: unknown;
}

const GENERATED_PATTERN = "packages/generated/**";

/**
 * Converte um outputDir em um pattern relativo ao workspace usado em
 * `files.readonlyInclude`. Aceita paths absolutos, `./relativos` e
 * `relativos`, sempre devolvendo um caminho relativo POSIX.
 */
function toReadonlyPattern(outputDir: string): string {
	const cwd = process.cwd();
	const absolute = path.isAbsolute(outputDir)
		? outputDir
		: path.resolve(cwd, outputDir);

	const relative = path.relative(cwd, absolute) || ".";
	const posix = relative.split(path.sep).join("/");
	return `${posix}/index.ts`;
}

function readSettings(settingsPath: string): VSCodeSettings {
	const content = fs.readFileSync(settingsPath, "utf-8");
	return JSON.parse(content) as VSCodeSettings;
}

/**
 * Verifica se o workspace está configurado para bloquear a edição dos arquivos gerados
 * @param outputDirs Lista de diretórios de saída a serem verificados
 * @returns Verdadeiro se os arquivos gerados estiverem protegidos contra escrita
 */
function isWorkspaceLocked(outputDirs: string[]): boolean {
	try {
		const settingsPath = path.join(process.cwd(), ".vscode", "settings.json");

		if (!fs.existsSync(settingsPath)) {
			return false;
		}

		const settings = readSettings(settingsPath);
		const readonlyInclude = settings["files.readonlyInclude"];
		if (!readonlyInclude || typeof readonlyInclude !== "object") {
			return false;
		}

		if (GENERATED_PATTERN in readonlyInclude) {
			return true;
		}

		return outputDirs
			.map((outputDir) => toReadonlyPattern(outputDir))
			.some((pattern) => pattern in readonlyInclude);
	} catch (error) {
		writeCliWarning(
			`Não foi possível verificar as configurações do workspace: ${formatErrorMessage(error)}`,
		);
		return false;
	}
}

/**
 * Bloqueia o acesso de escrita aos arquivos gerados adicionando as configurações apropriadas
 * ao arquivo .vscode/settings.json
 * @param outputDirs Lista de diretórios de saída a serem bloqueados
 */
function lockWorkspace(outputDirs: string[]): void {
	try {
		const vscodeDir = path.join(process.cwd(), ".vscode");
		const settingsPath = path.join(vscodeDir, "settings.json");

		if (!fs.existsSync(vscodeDir)) {
			fs.mkdirSync(vscodeDir, { recursive: true });
		}

		const settings: VSCodeSettings = fs.existsSync(settingsPath)
			? readSettings(settingsPath)
			: {};

		const existing = settings["files.readonlyInclude"];
		const readonlyInclude: Record<string, boolean> =
			existing && typeof existing === "object"
				? (existing as Record<string, boolean>)
				: {};

		readonlyInclude[GENERATED_PATTERN] = true;

		const uniqueOutputDirs = new Set(outputDirs);
		for (const outputDir of uniqueOutputDirs) {
			const pattern = toReadonlyPattern(outputDir);
			if (!(pattern in readonlyInclude)) {
				readonlyInclude[pattern] = true;
			}
		}

		settings["files.readonlyInclude"] = readonlyInclude;

		fs.writeFileSync(
			settingsPath,
			JSON.stringify(settings, null, "\t"),
			"utf-8",
		);
	} catch (error) {
		throw new Error(`Falha ao bloquear o workspace: ${error}`);
	}
}

/**
 * Aplica o bloqueio de workspace se a configuração estiver ativada
 * @param outputDirs Lista de diretórios de saída a serem bloqueados
 * @param lockWorkspaceFolder Indica se o workspace deve ser bloqueado
 */
export function applyWorkspaceLockIfNeeded(
	outputDirs: string[],
	lockWorkspaceFolder: boolean,
): void {
	if (lockWorkspaceFolder && !isWorkspaceLocked(outputDirs)) {
		lockWorkspace(outputDirs);
	}
}
