import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@shared/http/http-client", () => ({
	fetchJsonWithAuth: vi.fn(),
}));

import { fetchJsonWithAuth } from "@shared/http/http-client";
import {
	NocoBaseApiClient,
	type NocoBaseApiCredentials,
} from "./nocobase-client";

const mockFetchJsonWithAuth = vi.mocked(fetchJsonWithAuth);

const defaultCredentials: NocoBaseApiCredentials = {
	baseUrl: "http://localhost:13000/api",
	token: "test-token",
	timeoutMs: 5000,
};

class TestNocoBaseApiClient extends NocoBaseApiClient {
	public callFetchJson<T>(
		resourcePath: string,
		mapHttpError?: (params: {
			status: number;
			statusText: string;
			url: string;
			bodySuffix: string;
		}) => Error | undefined,
	): Promise<T> {
		return this.fetchJson<T>(resourcePath, mapHttpError);
	}

	public callFetchPaginated<T>(
		options: Parameters<NocoBaseApiClient["fetchPaginated"]>[0],
	): Promise<T[]> {
		return this.fetchPaginated<T>(options);
	}

	public callFetchCollections(dataSourceKey: string): Promise<unknown[]> {
		return this.fetchCollections(dataSourceKey);
	}
}

describe("nocobase-client", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("constructor", () => {
		it("TC-UT-NB-001: stores baseUrl from credentials", () => {
			const client = new TestNocoBaseApiClient(defaultCredentials);

			expect(client.baseUrl).toBe(defaultCredentials.baseUrl);
		});

		it("TC-UT-NB-002: passes credentials and requestHeaders to fetchJsonWithAuth", async () => {
			mockFetchJsonWithAuth.mockResolvedValue({ ok: true });
			const requestHeaders = { "X-Custom": "value" };
			const client = new TestNocoBaseApiClient(defaultCredentials, {
				requestHeaders,
			});

			await client.callFetchJson("collections");

			expect(mockFetchJsonWithAuth).toHaveBeenCalledWith("collections", {
				baseUrl: defaultCredentials.baseUrl,
				token: defaultCredentials.token,
				timeoutMs: defaultCredentials.timeoutMs,
				requestHeaders,
				mapHttpError: undefined,
			});
		});

		it("TC-UT-NB-003: omits requestHeaders when options are not provided", async () => {
			mockFetchJsonWithAuth.mockResolvedValue({});
			const client = new TestNocoBaseApiClient(defaultCredentials);

			await client.callFetchJson("roles");

			expect(mockFetchJsonWithAuth).toHaveBeenCalledWith("roles", {
				baseUrl: defaultCredentials.baseUrl,
				token: defaultCredentials.token,
				timeoutMs: defaultCredentials.timeoutMs,
				requestHeaders: undefined,
				mapHttpError: undefined,
			});
		});
	});

	describe("fetchJson", () => {
		it("TC-UT-NB-004: delegates response from fetchJsonWithAuth", async () => {
			const payload = { id: 1, name: "main" };
			mockFetchJsonWithAuth.mockResolvedValue(payload);
			const client = new TestNocoBaseApiClient(defaultCredentials);

			const result =
				await client.callFetchJson<typeof payload>("dataSources/main");

			expect(result).toEqual(payload);
		});

		it("TC-UT-NB-005: forwards mapHttpError to fetchJsonWithAuth", async () => {
			const mapHttpError = vi.fn().mockReturnValue(new Error("mapped"));
			mockFetchJsonWithAuth.mockRejectedValue(new Error("mapped"));
			const client = new TestNocoBaseApiClient(defaultCredentials);

			await expect(
				client.callFetchJson("missing", mapHttpError),
			).rejects.toThrow("mapped");

			expect(mockFetchJsonWithAuth).toHaveBeenCalledWith(
				"missing",
				expect.objectContaining({ mapHttpError }),
			);
		});
	});

	describe("fetchPaginated", () => {
		it("TC-UT-NB-006: returns entries from a single page", async () => {
			const client = new TestNocoBaseApiClient(defaultCredentials);
			const fetchPage = vi.fn().mockResolvedValue({
				entries: [{ id: 1 }, { id: 2 }],
				hasNextPage: false,
			});

			const result = await client.callFetchPaginated({
				pageSize: 10,
				fetchPage,
			});

			expect(result).toEqual([{ id: 1 }, { id: 2 }]);
			expect(fetchPage).toHaveBeenCalledTimes(1);
			expect(fetchPage).toHaveBeenCalledWith(1, 10);
		});

		it("TC-UT-NB-007: aggregates entries across multiple pages", async () => {
			const client = new TestNocoBaseApiClient(defaultCredentials);
			const fetchPage = vi
				.fn()
				.mockResolvedValueOnce({
					entries: [{ id: 1 }],
					hasNextPage: true,
				})
				.mockResolvedValueOnce({
					entries: [{ id: 2 }],
					hasNextPage: true,
				})
				.mockResolvedValueOnce({
					entries: [{ id: 3 }],
					hasNextPage: false,
				});

			const result = await client.callFetchPaginated({
				pageSize: 2,
				fetchPage,
			});

			expect(result).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
			expect(fetchPage).toHaveBeenCalledTimes(3);
			expect(fetchPage).toHaveBeenNthCalledWith(1, 1, 2);
			expect(fetchPage).toHaveBeenNthCalledWith(2, 2, 2);
			expect(fetchPage).toHaveBeenNthCalledWith(3, 3, 2);
		});

		it("TC-UT-NB-008: returns empty array when first page has no entries", async () => {
			const client = new TestNocoBaseApiClient(defaultCredentials);
			const fetchPage = vi.fn().mockResolvedValue({
				entries: [],
				hasNextPage: false,
			});

			const result = await client.callFetchPaginated({
				pageSize: 50,
				fetchPage,
			});

			expect(result).toEqual([]);
			expect(fetchPage).toHaveBeenCalledTimes(1);
		});
	});

	describe("fetchCollections", () => {
		it("TC-UT-NB-009: returns array response as-is", async () => {
			const collections = [{ name: "t_pessoas" }, { name: "t_empresas" }];
			mockFetchJsonWithAuth.mockResolvedValue(collections);
			const client = new TestNocoBaseApiClient(defaultCredentials);

			const result = await client.callFetchCollections("main");

			expect(result).toEqual(collections);
			expect(mockFetchJsonWithAuth).toHaveBeenCalledWith(
				"dataSources/main/collections:list?paginate=false",
				expect.any(Object),
			);
		});

		it("TC-UT-NB-010: unwraps { data: [] } response", async () => {
			const collections = [{ name: "t_negociacoes" }];
			mockFetchJsonWithAuth.mockResolvedValue({ data: collections });
			const client = new TestNocoBaseApiClient(defaultCredentials);

			const result = await client.callFetchCollections("ixc");

			expect(result).toEqual(collections);
		});

		it("TC-UT-NB-011: returns [] when data is null", async () => {
			mockFetchJsonWithAuth.mockResolvedValue({ data: null });
			const client = new TestNocoBaseApiClient(defaultCredentials);

			const result = await client.callFetchCollections("main");

			expect(result).toEqual([]);
		});

		it("TC-UT-NB-012: returns [] for invalid or missing data shape", async () => {
			mockFetchJsonWithAuth.mockResolvedValue({ data: "not-an-array" });
			const client = new TestNocoBaseApiClient(defaultCredentials);

			const result = await client.callFetchCollections("main");

			expect(result).toEqual([]);
		});

		it("TC-UT-NB-013: returns [] when response is neither array nor wrapped data", async () => {
			mockFetchJsonWithAuth.mockResolvedValue({ meta: { count: 0 } });
			const client = new TestNocoBaseApiClient(defaultCredentials);

			const result = await client.callFetchCollections("main");

			expect(result).toEqual([]);
		});
	});
});
