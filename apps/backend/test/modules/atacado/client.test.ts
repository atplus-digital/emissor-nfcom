import { describe, expect, it, mock } from "bun:test";
import {
	AtacadoError,
	createAtacadoClient,
} from "#/modules/atacado/atacado.client";

// Mock do env ANTES dos imports dinâmicos (o client lê `#/env` lazy quando o
// caller não injeta as creds — mesmo padrão do test/integration/flow.test.ts).
mock.module("#/env", () => ({
	env: {
		NOCOBASE_API_URL: "https://atacado.env.test/api",
		NOCOBASE_API_KEY: "env-key",
		NOCOBASE_APP: "env-app",
	},
}));

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

	it("get: id inexistente (200 { data: null }) → AtacadoError 404", async () => {
		// NocoBase `:get` de id inexistente NÃO responde 404 — responde 200 com
		// `{ data: null }`. Sem a normalização o `null` vaza e o translator
		// estoura em `e.id` (regressão: GET /faturas/:id/emissao → 500).
		const f = fakeFetch({ status: 200, body: { data: null } });
		const client = createAtacadoClient({ fetchImpl: f, ...NO_ENV_OPTS });
		await expect(
			client.get("t_nfcom_faturas", { filterByTk: 99999999 }),
		).rejects.toBeInstanceOf(AtacadoError);
		await expect(
			client.get("t_nfcom_faturas", { filterByTk: 99999999 }),
		).rejects.toMatchObject({ statusCode: 404 });
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

describe("atacado.client · env lazy (sem opts injetados)", () => {
	it("usa env.NOCOBASE_* quando o caller não injeta creds", async () => {
		const f = fakeFetch({ status: 200, body: { id: 1 } });
		const client = createAtacadoClient({ fetchImpl: f });
		await client.get("t_parceiros", { filterByTk: 1 });
		const url = (f as unknown as ReturnType<typeof mock>).mock.calls[0][0] as string;
		expect(url).toContain("https://atacado.env.test/api/t_parceiros:get");
		const init = (f as unknown as ReturnType<typeof mock>).mock.calls[0][1] as RequestInit;
		const headers = init.headers as Record<string, string>;
		expect(headers.Authorization).toBe("Bearer env-key");
		expect(headers["X-App"]).toBe("env-app");
	});
});

describe("atacado.client · update/destroy (POST :action, NocoBase)", () => {
	it("update: POST :update com filterByTk e body JSON; 204 vazio → resolve", async () => {
		const f = fakeFetch({ status: 204, text: "" });
		const client = createAtacadoClient({ fetchImpl: f, ...NO_ENV_OPTS });
		await client.update("t_nfcom_faturas", 101, { f_status: "emitindo" });
		const init = (f as unknown as ReturnType<typeof mock>).mock.calls[0][1] as RequestInit;
		expect(init.method).toBe("POST");
		const url = (f as unknown as ReturnType<typeof mock>).mock.calls[0][0] as string;
		expect(url).toContain("t_nfcom_faturas:update");
		expect(url).toContain("filterByTk=101");
		expect(JSON.parse(String(init.body))).toEqual({ f_status: "emitindo" });
	});

	it("update não-2xx → AtacadoError com status e detail", async () => {
		const f = fakeFetch({ status: 500, text: "boom" });
		const client = createAtacadoClient({ fetchImpl: f, ...NO_ENV_OPTS });
		const err = await client.update("t_nfcom_faturas", 101, {}).catch((e: Error) => e);
		expect(err).toBeInstanceOf(AtacadoError);
		expect((err as AtacadoError).statusCode).toBe(500);
		expect((err as AtacadoError).detail).toBe("boom");
	});

	it("destroy: POST :destroy com filterByTk; 204 → resolve", async () => {
		const f = fakeFetch({ status: 204, text: "" });
		const client = createAtacadoClient({ fetchImpl: f, ...NO_ENV_OPTS });
		await client.destroy("t_nfcom_cobrancas", 456);
		const url = (f as unknown as ReturnType<typeof mock>).mock.calls[0][0] as string;
		expect(url).toContain("t_nfcom_cobrancas:destroy");
		expect(url).toContain("filterByTk=456");
	});

	it("destroy não-2xx → AtacadoError", async () => {
		const f = fakeFetch({ status: 404, text: "not found" });
		const client = createAtacadoClient({ fetchImpl: f, ...NO_ENV_OPTS });
		const err = await client.destroy("t_nfcom_cobrancas", 456).catch((e: Error) => e);
		expect(err).toBeInstanceOf(AtacadoError);
		expect((err as AtacadoError).statusCode).toBe(404);
	});
});

describe("atacado.client · list (envolvido ou array direto)", () => {
	it("resposta { data: [...] } → array; array direto → array", async () => {
		const f1 = fakeFetch({ status: 200, body: { data: [{ id: 1 }, { id: 2 }] } });
		const c1 = createAtacadoClient({ fetchImpl: f1, ...NO_ENV_OPTS });
		expect(await c1.list("t_clientes", {})).toEqual([{ id: 1 }, { id: 2 }]);

		const f2 = fakeFetch({ status: 200, body: [{ id: 9 }] });
		const c2 = createAtacadoClient({ fetchImpl: f2, ...NO_ENV_OPTS });
		expect(await c2.list("t_clientes", {})).toEqual([{ id: 9 }]);
	});

	it("list não-2xx → AtacadoError (requestJson)", async () => {
		const f = fakeFetch({ status: 503, text: "down" });
		const client = createAtacadoClient({ fetchImpl: f, ...NO_ENV_OPTS });
		await expect(client.list("t_clientes", {})).rejects.toBeInstanceOf(AtacadoError);
	});
});

describe("atacado.client · listPage (paginação real + total do filtro)", () => {
	it("envolvido { data, meta } → items da página + total do meta.count", async () => {
		const f = fakeFetch({
			status: 200,
			body: {
				data: [{ id: 1 }, { id: 2 }],
				meta: { count: 42, page: 2, pageSize: 2, totalPage: 21 },
			},
		});
		const client = createAtacadoClient({ fetchImpl: f, ...NO_ENV_OPTS });
		const r = await client.listPage("t_clientes", {
			filter: { f_fk_parceiro: 42 },
			page: 2,
			pageSize: 2,
		});
		expect(r.items).toEqual([{ id: 1 }, { id: 2 }]);
		expect(r.total).toBe(42);
	});

	it("array direto (sem meta) → total degrada p/ tamanho da página", async () => {
		const f = fakeFetch({ status: 200, body: [{ id: 9 }, { id: 10 }] });
		const client = createAtacadoClient({ fetchImpl: f, ...NO_ENV_OPTS });
		const r = await client.listPage("t_clientes", { pageSize: 5 });
		expect(r.items).toEqual([{ id: 9 }, { id: 10 }]);
		expect(r.total).toBe(2);
	});

	it("page/pageSize entram na query (sem o default 9999); sem page → 1", async () => {
		const f = fakeFetch({ status: 200, body: { data: [] } });
		const client = createAtacadoClient({ fetchImpl: f, ...NO_ENV_OPTS });
		await client.listPage("t_clientes", { page: 3, pageSize: 7 });
		let params = new URL(
			(f as unknown as ReturnType<typeof mock>).mock.calls[0][0] as string,
		).searchParams;
		expect(params.get("page")).toBe("3");
		expect(params.get("pageSize")).toBe("7");

		const f2 = fakeFetch({ status: 200, body: { data: [] } });
		const client2 = createAtacadoClient({ fetchImpl: f2, ...NO_ENV_OPTS });
		await client2.listPage("t_clientes", { pageSize: 7 });
		params = new URL(
			(f2 as unknown as ReturnType<typeof mock>).mock.calls[0][0] as string,
		).searchParams;
		expect(params.get("page")).toBe("1");
		expect(params.get("pageSize")).toBe("7");
	});

	it("filter (objeto) → JSON na query", async () => {
		const f = fakeFetch({ status: 200, body: { data: [] } });
		const client = createAtacadoClient({ fetchImpl: f, ...NO_ENV_OPTS });
		await client.listPage("t_clientes", {
			filter: { f_uf: { $eq: "PR" } },
			pageSize: 10,
		});
		const params = new URL(
			(f as unknown as ReturnType<typeof mock>).mock.calls[0][0] as string,
		).searchParams;
		expect(params.get("filter")).toBe(JSON.stringify({ f_uf: { $eq: "PR" } }));
	});

	it("listPage não-2xx → AtacadoError", async () => {
		const f = fakeFetch({ status: 500, text: "boom" });
		const client = createAtacadoClient({ fetchImpl: f, ...NO_ENV_OPTS });
		await expect(
			client.listPage("t_clientes", { pageSize: 10 }),
		).rejects.toBeInstanceOf(AtacadoError);
	});
});
