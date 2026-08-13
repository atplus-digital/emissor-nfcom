export function isPnpmCommand(command: string): boolean {
	return command === "pnpm" || command === "pnpm.cmd";
}
