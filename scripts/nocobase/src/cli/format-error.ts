/**
 * Extrai mensagem legível de erros desconhecidos (throw, reject, etc.).
 */
export function formatErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}

	return String(error);
}
