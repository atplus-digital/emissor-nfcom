import { describe, expect, it, mock } from "bun:test";
import {
	AtacadoError,
	createAtacadoClient,
} from "#/modules/atacado/atacado.client";

/** fetch fake — retorna Response-like com status + json/text (o cliente lê
 * `text` via httpFetch, ADR-0005). Sem `text` explícito, serializa o `body`. */
function fakeFetch(response: {
	status: number;
	body?: unknown;
	text?: string;
}) {
	return mock((_url: string, _init?: RequestInit) =>
		Promise.resolve({
			ok: response.status >= 200 && response.status < 300,
			status: response.status,
			json: () => Promise.resolve(response.body ?? {}),
			text: () =>
				Promise.resolve(
					response.text ??
						(response.body !== undefined ? JSON.stringify(response.body) : ""),
				),
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
		await client.get("t_parceiros", { filterByTk: 1 });
		const url = (f as unknown as ReturnType<typeof mock>).mock
			.calls[0][0] as string;
		expect(url).toContain("https://atacado.test/t_parceiros:get");
	});

	it("envia os headers Authorization: Bearer {apiKey} e X-App", async () => {
		const f = fakeFetch({ status: 200, body: { id: 1 } });
		const client = createAtacadoClient({ fetchImpl: f, ...NO_ENV_OPTS });
		await client.get("t_parceiros", { filterByTk: 1 });
		const init = (f as unknown as ReturnType<typeof mock>).mock
			.calls[0][1] as RequestInit;
		const headers = init.headers as Record<string, string>;
		expect(headers.Authorization).toBe("Bearer test-key");
		expect(headers["X-App"]).toBe("testapp");
	});

	it("omite o header X-App quando app não é informado", async () => {
		const f = fakeFetch({ status: 200, body: { id: 1 } });
		const client = createAtacadoClient({
			fetchImpl: f,
			baseUrl: "https://atacado.test",
			apiKey: "test-key",
			app: "",
		});
		await client.get("t_parceiros", { filterByTk: 1 });
		const init = (f as unknown as ReturnType<typeof mock>).mock
			.calls[0][1] as RequestInit;
		const headers = init.headers as Record<string, string>;
		expect(headers["X-App"]).toBeUndefined();
	});
	it("get: extrai o registro do envelope NocoBase { data }", async () => {
		const f = fakeFetch({
			status: 200,
			body: { data: { id: 17, f_razao_social: "Mateus" } },
		});
		const client = createAtacadoClient({ fetchImpl: f, ...NO_ENV_OPTS });
		const r = await client.get("t_parceiros", { filterByTk: 17 });
		expect(r).toEqual({ id: 17, f_razao_social: "Mateus" });
	});

	it("create: extrai o registro do envelope NocoBase { data }", async () => {
		const f = fakeFetch({
			status: 200,
			body: { data: { id: 99 } },
		});
		const client = createAtacadoClient({ fetchImpl: f, ...NO_ENV_OPTS });
		const r = await client.create("t_nfcom_faturas", { f_status: "a-emitir" });
		expect(r).toEqual({ id: 99 });
	});
});

describe("atacado.client · codificação de query (NocoBase)", () => {
	/** NocoBase espera `appends` como CSV — `["a","b"]` (JSON) é lido como um
	 * único nome de associação e rejeitado com "association ... not found".
	 * `filter` (objeto) continua como JSON; primitivos como String. */
	it("appends (array) → CSV separado por vírgulas", async () => {
		const f = fakeFetch({ status: 200, body: { data: [] } });
		const client = createAtacadoClient({ fetchImpl: f, ...NO_ENV_OPTS });
		await client.list("t_clientes", {
			appends: ["f_linhas_fixas", "f_linhas_fixas.f_planos_de_servico"],
		});
		const url = (f as unknown as ReturnType<typeof mock>).mock.calls[0][0] as string;
		const params = new URL(url).searchParams;
		expect(params.get("appends")).toBe(
			"f_linhas_fixas,f_linhas_fixas.f_planos_de_servico",
		);
	});

	it("filter (objeto) → JSON", async () => {
		const f = fakeFetch({ status: 200, body: { data: [] } });
		const client = createAtacadoClient({ fetchImpl: f, ...NO_ENV_OPTS });
		await client.list("t_clientes", { filter: { f_fk_parceiro: 10 } });
		const url = (f as unknown as ReturnType<typeof mock>).mock.calls[0][0] as string;
		expect(new URL(url).searchParams.get("filter")).toBe(
			JSON.stringify({ f_fk_parceiro: 10 }),
		);
	});

	it("primitivo (number) → String, sem aspas", async () => {
		const f = fakeFetch({ status: 200, body: { data: { id: 1 } } });
		const client = createAtacadoClient({ fetchImpl: f, ...NO_ENV_OPTS });
		await client.get("t_parceiros", { filterByTk: 42 });
		const url = (f as unknown as ReturnType<typeof mock>).mock.calls[0][0] as string;
		expect(new URL(url).searchParams.get("filterByTk")).toBe("42");
	});
});

describe("atacado.client · AtacadoError", () => {
	it("carrega statusCode", async () => {
		const f = fakeFetch({ status: 500, text: "boom" });
		const client = createAtacadoClient({ fetchImpl: f, ...NO_ENV_OPTS });
		await expect(
			client.get("parceiros", { filterByTk: 1 }),
		).rejects.toBeInstanceOf(AtacadoError);
		await expect(
			client.get("parceiros", { filterByTk: 1 }),
		).rejects.toMatchObject({
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
