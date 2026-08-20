import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	mock,
	vi,
} from "bun:test";

mock.module("@generators/http/http-client", () => ({
	fetchJsonWithAuth: vi.fn(),
}));

import { fetchJsonWithAuth } from "@generators/http/http-client";
import {
	NocoBaseApiClient,
	type NocoBaseApiCredentials,
} from "./nocobase-client";

const mockFetchJsonWithAuth = fetchJsonWithAuth;

const defaultCredentials: NocoBaseApiCredentials = {
	baseUrl: "http://localhost:13000/api",
	token: "test-token",
	timeoutMs: 5000,
};

describe("nocobase-client", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("constructor", () => {
		it("TC-UT-NB-001: stores baseUrl from credentials", () => {
			const client = new NocoBaseApiClient(defaultCredentials);

			expect(client.baseUrl).toBe(defaultCredentials.baseUrl);
		});
	});

	describe("fetchCollections", () => {
		it("TC-UT-NB-002: passes credentials and requestHeaders to fetchJsonWithAuth", async () => {
			mockFetchJsonWithAuth.mockResolvedValue([]);
			const requestHeaders = { "X-Custom": "value" };
			const client = new NocoBaseApiClient(defaultCredentials, {
				requestHeaders,
			});

			await client.fetchCollections("main");

			expect(mockFetchJsonWithAuth).toHaveBeenCalledWith(
				"dataSources/main/collections:list?paginate=false",
				{
					baseUrl: defaultCredentials.baseUrl,
					token: defaultCredentials.token,
					timeoutMs: defaultCredentials.timeoutMs,
					requestHeaders,
				},
			);
		});

		it("TC-UT-NB-003: omits requestHeaders when options are not provided", async () => {
			mockFetchJsonWithAuth.mockResolvedValue([]);
			const client = new NocoBaseApiClient(defaultCredentials);

			await client.fetchCollections("main");

			expect(mockFetchJsonWithAuth).toHaveBeenCalledWith(
				"dataSources/main/collections:list?paginate=false",
				{
					baseUrl: defaultCredentials.baseUrl,
					token: defaultCredentials.token,
					timeoutMs: defaultCredentials.timeoutMs,
					requestHeaders: undefined,
				},
			);
		});

		it("TC-UT-NB-004: propagates HTTP errors from fetchJsonWithAuth", async () => {
			mockFetchJsonWithAuth.mockRejectedValue(new Error("boom"));
			const client = new NocoBaseApiClient(defaultCredentials);

			await expect(client.fetchCollections("main")).rejects.toThrow("boom");
		});

		it("TC-UT-NB-009: returns array response as-is", async () => {
			const collections = [{ name: "t_pessoas" }, { name: "t_empresas" }];
			mockFetchJsonWithAuth.mockResolvedValue(collections);
			const client = new NocoBaseApiClient(defaultCredentials);

			const result = await client.fetchCollections("main");

			expect(result).toEqual(collections);
		});

		it("TC-UT-NB-010: unwraps { data: [] } response", async () => {
			const collections = [{ name: "t_negociacoes" }];
			mockFetchJsonWithAuth.mockResolvedValue({ data: collections });
			const client = new NocoBaseApiClient(defaultCredentials);

			const result = await client.fetchCollections("ixc");

			expect(result).toEqual(collections);
		});

		it("TC-UT-NB-011: returns [] when data is null", async () => {
			mockFetchJsonWithAuth.mockResolvedValue({ data: null });
			const client = new NocoBaseApiClient(defaultCredentials);

			const result = await client.fetchCollections("main");

			expect(result).toEqual([]);
		});

		it("TC-UT-NB-012: returns [] for invalid or missing data shape", async () => {
			mockFetchJsonWithAuth.mockResolvedValue({ data: "not-an-array" });
			const client = new NocoBaseApiClient(defaultCredentials);

			const result = await client.fetchCollections("main");

			expect(result).toEqual([]);
		});

		it("TC-UT-NB-013: returns [] when response is neither array nor wrapped data", async () => {
			mockFetchJsonWithAuth.mockResolvedValue({ meta: { count: 0 } });
			const client = new NocoBaseApiClient(defaultCredentials);

			const result = await client.fetchCollections("main");

			expect(result).toEqual([]);
		});
	});
});
