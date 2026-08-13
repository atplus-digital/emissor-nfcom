import { fetchJsonWithAuth } from "@shared/http/http-client";

export interface NocoBaseApiCredentials {
	baseUrl: string;
	token: string;
	timeoutMs: number;
}

export interface NocoBaseApiClientOptions {
	requestHeaders?: Record<string, string>;
}

interface FetchPageResult<T> {
	entries: T[];
	hasNextPage: boolean;
}

export abstract class NocoBaseApiClient {
	public readonly baseUrl: string;

	private readonly token: string;

	private readonly timeoutMs: number;

	private readonly requestHeaders?: Record<string, string>;

	protected constructor(
		credentials: NocoBaseApiCredentials,
		options?: NocoBaseApiClientOptions,
	) {
		this.baseUrl = credentials.baseUrl;
		this.token = credentials.token;
		this.timeoutMs = credentials.timeoutMs;
		this.requestHeaders = options?.requestHeaders;
	}

	protected async fetchJson<T>(
		resourcePath: string,
		mapHttpError?: (params: {
			status: number;
			statusText: string;
			url: string;
			bodySuffix: string;
		}) => Error | undefined,
	): Promise<T> {
		return fetchJsonWithAuth<T>(resourcePath, {
			baseUrl: this.baseUrl,
			token: this.token,
			timeoutMs: this.timeoutMs,
			requestHeaders: this.requestHeaders,
			mapHttpError,
		});
	}

	protected async fetchPaginated<T>(options: {
		pageSize: number;
		fetchPage: (page: number, pageSize: number) => Promise<FetchPageResult<T>>;
	}): Promise<T[]> {
		const allEntries: T[] = [];
		let page = 1;

		while (true) {
			const result = await options.fetchPage(page, options.pageSize);
			allEntries.push(...result.entries);

			if (!result.hasNextPage) {
				break;
			}

			page++;
		}

		return allEntries;
	}

	protected async fetchCollections(dataSourceKey: string): Promise<unknown[]> {
		const response = await this.fetchJson<
			unknown[] | { data?: unknown[] | null }
		>(`dataSources/${dataSourceKey}/collections:list?paginate=false`);

		if (Array.isArray(response)) {
			return response;
		}

		if (Array.isArray(response.data)) {
			return response.data;
		}

		return [];
	}
}
