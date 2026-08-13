import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeCliError } from "@generators/lib/cli/cli-output";
import { formatErrorMessage } from "@generators/lib/cli/format-error";

const execFileAsync = promisify(execFile);

function isWindows(): boolean {
	return process.platform === "win32";
}

async function runCommand(
	label: string,
	cmd: string,
	args: string[],
): Promise<void> {
	try {
		const resolvedCmd = cmd === "pnpm" && isWindows() ? "pnpm.cmd" : cmd;
		const options = {
			maxBuffer: 10 * 1024 * 1024,
			windowsHide: true,
			...(isWindows() && { shell: true }),
		};
		const { stdout: _stdout, stderr } = await execFileAsync(
			resolvedCmd,
			args,
			options,
		);

		if (stderr) writeCliError(stderr);
	} catch (error) {
		const message = formatErrorMessage(error);
		writeCliError(`❌ ${label} falhou: ${message}`);
		throw new Error(`Falha ao executar ${label}: ${message}`);
	}
}

export async function runLinterFix(dirs: string[]): Promise<void> {
	if (dirs.length === 0) return;

	const mdGlobs = dirs.map((d) => `${d}/**/*.md`);

	await Promise.all([
		runCommand(`Biome (${dirs.length} diretório(s))`, "pnpm", [
			"exec",
			"biome",
			"check",
			"--write",
			"--vcs-use-ignore-file=false",
			...dirs,
		]),
		runCommand("Prettier (markdown)", "pnpm", [
			"dlx",
			"prettier",
			"--write",
			"--no-error-on-unmatched-pattern",
			...mdGlobs,
		]),
	]);
}
