/**
 * Helpers compartilhados p/ os testes de env (ADR-0005).
 *
 * Cada arquivo de teste roda em processo próprio (`bun test --isolate`), então
 * aqui montamos o `process.env` de forma determinística: limpamos tudo que foi
 * herdado e setamos somente o que o cenário precisa.
 */

/** Remove todas as variáveis de ambiente herdadas (determinismo). */
export function clearEnv() {
	for (const k of Object.keys(process.env)) {
		delete process.env[k];
	}
}

/**
 * Aplica uma env parcial por cima de uma base. Se a env (`env.ts`) não valida,
 * o import rejeitado fica "envenenado" no processo — por isso cada arquivo de
 * teste mantém UM único cenário de validação.
 */
export function setEnv(entries: Record<string, string>) {
	for (const [k, v] of Object.entries(entries)) {
		process.env[k] = v;
	}
}
