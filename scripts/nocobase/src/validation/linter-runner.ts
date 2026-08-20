import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeCliError } from "@generators/cli/cli-output";
import { formatErrorMessage } from "@generators/cli/format-error";

const execFileAsync = promisify(execFile);

async function runCommand(
	label: string,
	cmd: string,
	args: string[],
): Promise<void> {
	try {
		const { stdout: _stdout, stderr } = await execFileAsync(cmd, args, {
			maxBuffer: 10 * 1024 * 1024,
		});

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
		runCommand(`Biome (${dirs.length} diretório(s))`, "bunx", [
			"biome",
			"check",
			"--write",
			"--vcs-use-ignore-file=false",
			...dirs,
		]),
		runCommand("Prettier (markdown)", "bunx", [
			"prettier",
			"--write",
			"--no-error-on-unmatched-pattern",
			...mdGlobs,
		]),
	]);
}
