import { fetchJsonWithAuth } from "@generators/http/http-client";

export interface NocoBaseApiCredentials {
	baseUrl: string;
	token: string;
	timeoutMs: number;
}

export interface NocoBaseApiClientOptions {
	requestHeaders?: Record<string, string>;
}

/**
 * Concrete client for the NocoBase REST API. All datasources of an
 * instance (e.g. `main`, `d_db_ixcsoft`) are served by the same class —
 * the datasource key is a path parameter, not a different client.
 */
export class NocoBaseApiClient {
	public readonly baseUrl: string;

	private readonly token: string;

	private readonly timeoutMs: number;

	private readonly requestHeaders?: Record<string, string>;

	constructor(
		credentials: NocoBaseApiCredentials,
		options?: NocoBaseApiClientOptions,
	) {
		this.baseUrl = credentials.baseUrl;
		this.token = credentials.token;
		this.timeoutMs = credentials.timeoutMs;
		this.requestHeaders = options?.requestHeaders;
	}

	/**
	 * Fetch collections (with fields) for a data source. Accepts either the
	 * raw array or a `{ data: [...] }` wrapped response.
	 */
	public async fetchCollections(dataSourceKey: string): Promise<unknown[]> {
		const response = await fetchJsonWithAuth<
			unknown[] | { data?: unknown[] | null }
		>(`dataSources/${dataSourceKey}/collections:list?paginate=false`, {
			baseUrl: this.baseUrl,
			token: this.token,
			timeoutMs: this.timeoutMs,
			requestHeaders: this.requestHeaders,
		});

		if (Array.isArray(response)) {
			return response;
		}

		if (Array.isArray(response.data)) {
			return response.data;
		}

		return [];
	}
}
