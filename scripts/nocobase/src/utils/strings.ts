/**
 * Converte string escapada por JSON.stringify() para string single-quoted TypeScript.
 *
 * Quando geramos código TypeScript com strings literais single-quoted,
 * precisamos converter o escape do JSON (\\t) de volta para o formato
 * correto de TypeScript single-quoted (\t).
 *
 * Regras:
 * - JSON escape `\\` (backslash) → `\` (simples, pois \ não tem significado em TS)
 * - JSON escape `\"` (double quote) → `"` (não precisa escapar em single-quoted)
 * - Single quote `'` → `\'` (precisa escapar em single-quoted)
 * - JSON escape `\n` → `\n` (mantém)
 * - JSON escape `\r` → `\r` (mantém)
 * - JSON escape `\t` → `\t` (mantém)
 *
 * @param jsonStr String já escapada por JSON.stringify()
 */
export function jsonToSingleQuotedString(jsonStr: string): string {
	// Remove aspas externas do JSON.stringify
	const inner = jsonStr.slice(1, -1);
	// Converte escapes JSON para escapes TypeScript single-quoted
	return inner
		.replace(/\\\\/g, "\\") // \\ no JSON → \ no TS
		.replace(/\\"/g, '"') // \" no JSON → " no TS (válido em single-quoted)
		.replace(/'/g, "\\'") // ' → \' (precisa escapar em single-quoted)
		.replace(/\\n/g, "\\n") // mantém \n
		.replace(/\\r/g, "\\r") // mantém \r
		.replace(/\\t/g, "\\t"); // mantém \t
}
