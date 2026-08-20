/**
 * Saída stderr padronizada para scripts de geração (mensagens em português).
 */
export function writeCliError(message: string): void {
	console.error(message);
}

export function writeCliWarning(message: string): void {
	console.warn(`⚠️ ${message}`);
}

/**
 * Imprime linhas de erro (ex.: saída do tsc), limitando volume no terminal.
 */
export function writeCliErrorLines(lines: string[], maxLines = 10): void {
	for (const line of lines.slice(0, maxLines)) {
		writeCliError(line);
	}
}
