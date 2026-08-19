import { describe, expect, it, mock } from "bun:test";
import { criarNfcomClient } from "#/modules/nfcom/nfcom.client";

// Mock do env ANTES dos imports dinâmicos (o client lê `#/env` lazy quando o
// caller não injeta baseUrl — mesmo padrão do test/integration/flow.test.ts).
mock.module("#/env", () => ({
	env: { NFCOM_API_URL: "https://nfcom.env.test" },
}));

/** fetch fake — retorna Response-like com status + text. */
function fakeFetch(response: {
	status: number;
	body?: unknown;
	text?: string;
}) {
	return mock((_url: string, _init?: RequestInit) =>
		Promise.resolve({
			ok: response.status >= 200 && response.status < 300,
			status: response.status,
			text: () =>
				Promise.resolve(
					response.text ??
						(response.body !== undefined ? JSON.stringify(response.body) : ""),
				),
		}),
	) as unknown as typeof fetch;
}

const NO_ENV_OPTS = {
	baseUrl: "https://nfcom.test",
	fetchImpl: undefined as unknown as typeof fetch,
};

describe("nfcom.client · lazy env / injetável", () => {
	it("constrói com baseUrl injetado sem disparar validação de env", async () => {
		const f = fakeFetch({ status: 200, body: { token: "t" } });
		const client = criarNfcomClient({
			baseUrl: "https://nfcom.test",
			fetchImpl: f,
		});
		await client.auth("l", "s");
		const url = (f as unknown as ReturnType<typeof mock>).mock
			.calls[0][0] as string;
		expect(url).toBe("https://nfcom.test/api/auth");
	});

	it("envia Authorization: Bearer {token} nos métodos autenticados", async () => {
		const f = fakeFetch({
			status: 200,
			body: [{ chave: "c", situacao: "AUTORIZADA", protocolo: "p" }],
		});
		const client = criarNfcomClient({
			baseUrl: "https://nfcom.test",
			fetchImpl: f,
		});
		await client.consultaLista("tok", "111", "2026-08-01", "2026-08-31");
		const init = (f as unknown as ReturnType<typeof mock>).mock
			.calls[0][1] as RequestInit;
		const headers = init.headers as Record<string, string>;
		expect(headers.Authorization).toBe("Bearer tok");
	});
});

describe("nfcom.client · env lazy (sem baseUrl injetado)", () => {
	it("usa env.NFCOM_API_URL quando o caller não injeta baseUrl", async () => {
		const f = fakeFetch({ status: 200, body: { token: "t" } });
		const client = criarNfcomClient({ fetchImpl: f });
		await client.auth("l", "s");
		const url = (f as unknown as ReturnType<typeof mock>).mock.calls[0][0] as string;
		expect(url).toBe("https://nfcom.env.test/api/auth");
	});
});

describe("nfcom.client · emitir", () => {
	it("POST /api/emitir com Bearer + payload; devolve a resposta do gateway", async () => {
		const f = fakeFetch({
			status: 200,
			body: { situacao: "AUTORIZADA", numero: 7, serie: 1, chave: "k", protocolo: "p" },
		});
		const client = criarNfcomClient({ baseUrl: "https://nfcom.test", fetchImpl: f });
		const res = await client.emitir("tok", { numero: 7 } as never);
		expect(res.situacao).toBe("AUTORIZADA");
		const init = (f as unknown as ReturnType<typeof mock>).mock.calls[0][1] as RequestInit;
		expect(init.method).toBe("POST");
		expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
		expect(JSON.parse(String(init.body))).toEqual({ numero: 7 });
	});

	it("non-2xx → NfcomApiError com status e corpo (makeError)", async () => {
		const f = fakeFetch({ status: 502, text: "bad gateway" });
		const client = criarNfcomClient({ baseUrl: "https://nfcom.test", fetchImpl: f });
		const err = await client.emitir("tok", { numero: 1 } as never).catch((e: Error) => e);
		expect(err).toBeInstanceOf(Error);
		expect((err as Error & { status: number }).status).toBe(502);
		expect((err as Error).message).toContain("502");
		expect((err as Error).message).toContain("bad gateway");
	});

	it("non-2xx com corpo JSON → erro contém o JSON serializado", async () => {
		const f = fakeFetch({ status: 401, body: { erro: "credenciais inválidas" } });
		const client = criarNfcomClient({ baseUrl: "https://nfcom.test", fetchImpl: f });
		const err = await client.auth("l", "s").catch((e: Error) => e);
		expect((err as Error & { status: number }).status).toBe(401);
		expect((err as Error).message).toContain("credenciais inválidas");
	});
});
