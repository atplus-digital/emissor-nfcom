import { describe, expect, it, mock } from "bun:test";
import { AtacadoError, createAtacadoClient } from "#/modules/atacado/atacado.client";

/** fetch fake — retorna Response-like com status + json/text. */
function fakeFetch(response: { status: number; body?: unknown; text?: string }) {
	return mock((_url: string, _init?: RequestInit) =>
		Promise.resolve({
			ok: response.status >= 200 && response.status < 300,
			status: response.status,
			json: () => Promise.resolve(response.body ?? {}),
			text: () => Promise.resolve(response.text ?? ""),
		}),
	) as unknown as typeof fetch;
}

/** Opts fixos p/ não tocar em `env` (que valida chaves reais). */
const NO_ENV_OPTS = {
	baseUrl: "https://atacado.test",
	apiKey: "test-key",
	app: "testapp",
} as const;

describe("atacado.client · lazy env / injetável", () => {
	it("constrói com opts injetados sem disparar validação de env", async () => {
		// Se importasse env no top-level, este teste já teria falhado ao importar.
		const f = fakeFetch({ status: 200, body: { id: 1 } });
		const client = createAtacadoClient({ fetchImpl: f, ...NO_ENV_OPTS });
		await client.get("parceiros", { filterByTk: 1 });
		const url = (f as unknown as ReturnType<typeof mock>).mock.calls[0][0] as string;
		expect(url).toContain("https://atacado.test/testapp/api/parceiros:get");
	});

	it("envia o header Authorization: Bearer {apiKey}", async () => {
		const f = fakeFetch({ status: 200, body: { id: 1 } });
		const client = createAtacadoClient({ fetchImpl: f, ...NO_ENV_OPTS });
		await client.get("parceiros", { filterByTk: 1 });
		const init = (f as unknown as ReturnType<typeof mock>).mock.calls[0][1] as RequestInit;
		const headers = init.headers as Record<string, string>;
		expect(headers.Authorization).toBe("Bearer test-key");
	});
});

describe("atacado.client · AtacadoError", () => {
	it("carrega statusCode", async () => {
		const f = fakeFetch({ status: 500, text: "boom" });
		const client = createAtacadoClient({ fetchImpl: f, ...NO_ENV_OPTS });
		await expect(client.get("parceiros", { filterByTk: 1 })).rejects.toBeInstanceOf(AtacadoError);
		await expect(client.get("parceiros", { filterByTk: 1 })).rejects.toMatchObject({
			statusCode: 500,
		});
	});

	it("isRetryable(): 5xx/408/429 → true; 4xx → false", () => {
		expect(new AtacadoError("x", 500, "").isRetryable()).toBe(true);
		expect(new AtacadoError("x", 503, "").isRetryable()).toBe(true);
		expect(new AtacadoError("x", 408, "").isRetryable()).toBe(true);
		expect(new AtacadoError("x", 429, "").isRetryable()).toBe(true);
		expect(new AtacadoError("x", 404, "").isRetryable()).toBe(false);
		expect(new AtacadoError("x", 422, "").isRetryable()).toBe(false);
		expect(new AtacadoError("x", 400, "").isRetryable()).toBe(false);
	});
});
