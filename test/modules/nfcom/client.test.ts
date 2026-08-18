import { describe, expect, it, mock } from "bun:test";
import { criarNfcomClient } from "#/modules/nfcom/nfcom.client";

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
