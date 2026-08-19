/**
 * Testes do wrapper HTTP único (ADR-0005) — timeout, repasse de erro de rede,
 * `{ res, text }` e fetchImpl injetável.
 */
import { describe, expect, mock, test } from "bun:test";
import { HttpTimeoutError, httpFetch } from "#/lib/http";

/** Response-like mínimo com `text()`. */
function fakeResponse(status: number, text: string) {
	return {
		ok: status >= 200 && status < 300,
		status,
		text: () => Promise.resolve(text),
	} as unknown as Response;
}

describe("httpFetch (ADR-0005)", () => {
	test("retorna { res, text } com fetchImpl injetado", async () => {
		const fetchImpl = mock((_url: unknown, _init?: unknown) =>
			Promise.resolve(fakeResponse(200, '{"ok":true}')),
		) as unknown as typeof fetch;

		const { res, text } = await httpFetch({
			url: "https://api.test/x",
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: '{"a":1}',
			fetchImpl,
		});

		expect(res.status).toBe(200);
		expect(text).toBe('{"ok":true}');
		expect(fetchImpl).toHaveBeenCalledTimes(1);
		const [url, init] = (fetchImpl as unknown as ReturnType<typeof mock>).mock
			.calls[0] as [string, RequestInit];
		expect(url).toBe("https://api.test/x");
		expect(init.method).toBe("POST");
		expect(init.body).toBe('{"a":1}');
		expect(init.signal).toBeDefined();
	});

	test("timeout → lança HttpTimeoutError (não repassa erro de rede)", async () => {
		// fetch fake que só resolve/rejeita quando o signal aborta (simula fetch real).
		const fetchImpl = mock(
			(_url: unknown, init?: RequestInit) =>
				new Promise((_resolve, reject) => {
					init?.signal?.addEventListener("abort", () => {
						const err = new Error("Aborted");
						err.name = "AbortError";
						reject(err);
					});
				}),
		) as unknown as typeof fetch;

		await expect(
			httpFetch({ url: "https://api.test/slow", timeoutMs: 20, fetchImpl }),
		).rejects.toBeInstanceOf(HttpTimeoutError);
		await expect(
			httpFetch({ url: "https://api.test/slow", timeoutMs: 20, fetchImpl }),
		).rejects.toMatchObject({ name: "HttpTimeoutError", timeoutMs: 20 });
	});

	test("erro de rede → repassa o erro original (não vira HttpTimeoutError)", async () => {
		const fetchImpl = mock(() =>
			Promise.reject(new Error("ECONNREFUSED")),
		) as unknown as typeof fetch;
		try {
			await httpFetch({ url: "https://api.test/x", fetchImpl });
			expect.unreachable("deveria lançar");
		} catch (err) {
			expect(err).toBeInstanceOf(Error);
			expect(err).not.toBeInstanceOf(HttpTimeoutError);
			expect((err as Error).message).toBe("ECONNREFUSED");
		}
	});
});
