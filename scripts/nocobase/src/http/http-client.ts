class HttpResponseError extends Error {
	public constructor(
		public readonly status: number,
		public readonly statusText: string,
		public readonly requestUrl: string,
		bodySuffix: string,
	) {
		super(`HTTP ${status} ${statusText} em ${requestUrl}${bodySuffix}`);
	}
}

/**
 * Retorna preview do body de erro HTTP (primeiros 200 caracteres, sem quebras de linha).
 */
function getErrorBodyPreview(rawBody: string): string {
	return rawBody.replaceAll(/\s+/g, " ").trim().slice(0, 200);
}

interface FetchJsonWithAuthOptions {
	baseUrl: string;
	token: string;
	timeoutMs: number;
	requestHeaders?: Record<string, string>;
	mapHttpError?: (params: {
		status: number;
		statusText: string;
		url: string;
		bodySuffix: string;
	}) => Error | undefined;
}

export async function fetchJsonWithAuth<T>(
	resourcePath: string,
	options: FetchJsonWithAuthOptions,
): Promise<T> {
	const url = `${options.baseUrl}/${resourcePath}`;
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

	try {
		const response = await fetch(url, {
			headers: {
				Authorization: `Bearer ${options.token}`,
				...(options.requestHeaders ?? {}),
			},
			signal: controller.signal,
		});

		if (!response.ok) {
			const body = await response.text().catch(() => "");
			const bodySuffix = body
				? ` - resposta: ${getErrorBodyPreview(body)}`
				: "";

			const mappedError = options.mapHttpError?.({
				status: response.status,
				statusText: response.statusText,
				url,
				bodySuffix,
			});
			if (mappedError) {
				throw mappedError;
			}

			throw new HttpResponseError(
				response.status,
				response.statusText,
				url,
				bodySuffix,
			);
		}

		return (await response.json()) as T;
	} catch (error) {
		if (error instanceof DOMException && error.name === "AbortError") {
			throw new Error(`Timeout de ${options.timeoutMs}ms ao acessar ${url}`);
		}
		throw error;
	} finally {
		clearTimeout(timeout);
	}
}
