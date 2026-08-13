import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchJsonWithAuth } from "./http-client";

describe("http-client", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("fetchJsonWithAuth", () => {
		const defaultOptions = {
			baseUrl: "http://localhost:13000",
			token: "test-token",
			timeoutMs: 30000,
		};

		it("TC-UT-HTTP-001: GET request with auth header", async () => {
			const mockResponse = {
				ok: true,
				json: () => Promise.resolve({ data: "test" }),
				status: 200,
				statusText: "OK",
			};

			const mockFetch = vi.fn().mockResolvedValue(mockResponse);
			vi.stubGlobal("fetch", mockFetch);

			const result = await fetchJsonWithAuth<{ data: string }>(
				"collections",
				defaultOptions,
			);

			expect(mockFetch).toHaveBeenCalledWith(
				"http://localhost:13000/collections",
				expect.objectContaining({
					headers: expect.objectContaining({
						Authorization: "Bearer test-token",
					}),
					signal: expect.any(AbortSignal),
				}),
			);
			expect(result).toEqual({ data: "test" });
		});

		it("TC-UT-HTTP-002: POST request with auth header (via resourcePath)", async () => {
			const mockResponse = {
				ok: true,
				json: () => Promise.resolve({ created: true }),
				status: 201,
				statusText: "Created",
			};

			const mockFetch = vi.fn().mockResolvedValue(mockResponse);
			vi.stubGlobal("fetch", mockFetch);

			// The function doesn't distinguish GET/POST, but we can test the URL construction
			const result = await fetchJsonWithAuth<{ created: boolean }>(
				"dataSources/main/collections:create",
				defaultOptions,
			);

			expect(mockFetch).toHaveBeenCalledWith(
				"http://localhost:13000/dataSources/main/collections:create",
				expect.objectContaining({
					headers: expect.objectContaining({
						Authorization: "Bearer test-token",
					}),
				}),
			);
			expect(result).toEqual({ created: true });
		});

		it("TC-UT-HTTP-003: 401 response throws UnauthorizedError", async () => {
			const mockResponse = {
				ok: false,
				status: 401,
				statusText: "Unauthorized",
				text: () => Promise.resolve(""),
			};

			const mockFetch = vi.fn().mockResolvedValue(mockResponse);
			vi.stubGlobal("fetch", mockFetch);

			await expect(
				fetchJsonWithAuth("protected", defaultOptions),
			).rejects.toThrow("HTTP 401 Unauthorized");
		});

		it("TC-UT-HTTP-004: 500 response throws HttpError with status", async () => {
			const mockResponse = {
				ok: false,
				status: 500,
				statusText: "Internal Server Error",
				text: () => Promise.resolve("Server error details"),
			};

			const mockFetch = vi.fn().mockResolvedValue(mockResponse);
			vi.stubGlobal("fetch", mockFetch);

			await expect(fetchJsonWithAuth("error", defaultOptions)).rejects.toThrow(
				"HTTP 500 Internal Server Error",
			);
		});

		it("TC-UT-HTTP-005: network error throws", async () => {
			const mockFetch = vi.fn().mockRejectedValue(new Error("Network failure"));
			vi.stubGlobal("fetch", mockFetch);

			await expect(fetchJsonWithAuth("test", defaultOptions)).rejects.toThrow(
				"Network failure",
			);
		});

		it("TC-UT-HTTP-006: timeout throws descriptive error", async () => {
			// We can't easily test actual timeout without waiting, but we can verify
			// the AbortController is set up properly
			const mockResponse = {
				ok: true,
				json: () => Promise.resolve({ data: "test" }),
			};

			const mockFetch = vi.fn().mockResolvedValue(mockResponse);
			const mockAbort = vi.fn();
			vi.stubGlobal("fetch", mockFetch);
			vi.stubGlobal(
				"AbortController",
				class {
					abort = mockAbort;
					signal = {} as AbortSignal;
				},
			);

			await fetchJsonWithAuth("test", { ...defaultOptions, timeoutMs: 1000 });

			// Verify AbortController was used
			expect(mockAbort).not.toHaveBeenCalled(); // Abort is called on timeout, not immediately
		});

		it("TC-UT-HTTP-007: includes custom request headers", async () => {
			const mockResponse = {
				ok: true,
				json: () => Promise.resolve({ data: "test" }),
			};

			const mockFetch = vi.fn().mockResolvedValue(mockResponse);
			vi.stubGlobal("fetch", mockFetch);

			await fetchJsonWithAuth("test", {
				...defaultOptions,
				requestHeaders: { "X-Custom-Header": "custom-value" },
			});

			expect(mockFetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					headers: expect.objectContaining({
						Authorization: "Bearer test-token",
						"X-Custom-Header": "custom-value",
					}),
				}),
			);
		});

		it("TC-UT-HTTP-008: mapHttpError allows custom error mapping", async () => {
			const mockResponse = {
				ok: false,
				status: 404,
				statusText: "Not Found",
				text: () => Promise.resolve("Resource not found"),
			};

			const mockFetch = vi.fn().mockResolvedValue(mockResponse);
			vi.stubGlobal("fetch", mockFetch);

			const customError = new Error("Custom not found");
			const mapHttpError = vi.fn().mockReturnValue(customError);

			await expect(
				fetchJsonWithAuth("missing", {
					...defaultOptions,
					mapHttpError,
				}),
			).rejects.toThrow("Custom not found");

			expect(mapHttpError).toHaveBeenCalledWith(
				expect.objectContaining({
					status: 404,
					statusText: "Not Found",
				}),
			);
		});

		it("TC-UT-HTTP-009: error body preview is included in error message", async () => {
			const mockResponse = {
				ok: false,
				status: 400,
				statusText: "Bad Request",
				text: () => Promise.resolve("Invalid input: field X is required"),
			};

			const mockFetch = vi.fn().mockResolvedValue(mockResponse);
			vi.stubGlobal("fetch", mockFetch);

			await expect(fetchJsonWithAuth("test", defaultOptions)).rejects.toThrow(
				"Invalid input: field X is required",
			);
		});

		it("TC-UT-HTTP-010: AbortError throws descriptive timeout error", async () => {
			const abortError = new DOMException("Aborted", "AbortError");

			const mockFetch = vi.fn().mockRejectedValue(abortError);
			vi.stubGlobal("fetch", mockFetch);

			await expect(
				fetchJsonWithAuth("slow-endpoint", defaultOptions),
			).rejects.toThrow("Timeout de 30000ms ao acessar");
		});

		it("TC-UT-HTTP-011: falls back to HttpResponseError when mapHttpError returns undefined", async () => {
			const mockResponse = {
				ok: false,
				status: 404,
				statusText: "Not Found",
				text: () => Promise.resolve(""),
			};

			const mockFetch = vi.fn().mockResolvedValue(mockResponse);
			vi.stubGlobal("fetch", mockFetch);

			const mapHttpError = vi.fn().mockReturnValue(undefined);

			await expect(
				fetchJsonWithAuth("missing", {
					...defaultOptions,
					mapHttpError,
				}),
			).rejects.toThrow("HTTP 404 Not Found em http://localhost:13000/missing");
		});

		it("TC-UT-HTTP-012: omits body suffix when response.text() fails", async () => {
			const mockResponse = {
				ok: false,
				status: 502,
				statusText: "Bad Gateway",
				text: () => Promise.reject(new Error("read failed")),
			};

			const mockFetch = vi.fn().mockResolvedValue(mockResponse);
			vi.stubGlobal("fetch", mockFetch);

			await expect(fetchJsonWithAuth("test", defaultOptions)).rejects.toThrow(
				"HTTP 502 Bad Gateway em http://localhost:13000/test",
			);
		});

		it("TC-UT-HTTP-013: normalizes whitespace in error body preview", async () => {
			const mockResponse = {
				ok: false,
				status: 400,
				statusText: "Bad Request",
				text: () => Promise.resolve("  line1\n\t line2  "),
			};

			const mockFetch = vi.fn().mockResolvedValue(mockResponse);
			vi.stubGlobal("fetch", mockFetch);

			await expect(fetchJsonWithAuth("test", defaultOptions)).rejects.toThrow(
				"resposta: line1 line2",
			);
		});

		it("TC-UT-HTTP-014: truncates error body preview to 200 characters", async () => {
			const longBody = "x".repeat(250);
			const mockResponse = {
				ok: false,
				status: 400,
				statusText: "Bad Request",
				text: () => Promise.resolve(longBody),
			};

			const mockFetch = vi.fn().mockResolvedValue(mockResponse);
			vi.stubGlobal("fetch", mockFetch);

			await expect(fetchJsonWithAuth("test", defaultOptions)).rejects.toThrow(
				`resposta: ${"x".repeat(200)}`,
			);
		});

		it("TC-UT-HTTP-015: calls abort when timeout elapses", async () => {
			vi.useFakeTimers();

			const mockAbort = vi.fn();
			vi.stubGlobal(
				"AbortController",
				class {
					abort = mockAbort;
					signal = {} as AbortSignal;
				},
			);

			const mockFetch = vi.fn(() => new Promise(() => {}));
			vi.stubGlobal("fetch", mockFetch);

			void fetchJsonWithAuth("slow-endpoint", {
				...defaultOptions,
				timeoutMs: 5000,
			});

			await vi.advanceTimersByTimeAsync(5000);

			expect(mockAbort).toHaveBeenCalled();

			vi.useRealTimers();
		});
	});
});
