/**
 * Testes do worker de webhook — WEBHOOK_URL desativada (SPEC-0001 caso 14).
 * TDD: vermelho (módulo ausente) → verde.
 */
import { describe, expect, mock, test } from "bun:test";
import { assinarWebhook, enviarWebhook } from "#/workers/webhook.worker";
import type { EventoWebhook } from "#/domain/types";

const evento: EventoWebhook = {
	eventoId: "id-1",
	faturaId: 123,
	tipo: "fatura.status",
	alvo: { faturaId: 123 },
	estado: "emitida",
	timestamp: "2026-08-17T12:00:00Z",
};

describe("enviarWebhook (SPEC-0001 caso 14 — URL vazia → não empurra)", () => {
	test("url vazia → no-op (sem fetch, resolve)", async () => {
		const fetchImpl = mock(() => Promise.resolve(new Response()));
		await enviarWebhook(evento, {
			url: "",
			secret: "segredo",
			fetchImpl: fetchImpl as unknown as typeof fetch,
		});
		expect(fetchImpl).not.toHaveBeenCalled();
	});

	test("url undefined → no-op", async () => {
		const fetchImpl = mock(() => Promise.resolve(new Response()));
		await enviarWebhook(evento, {
			url: undefined as unknown as string,
			secret: "segredo",
			fetchImpl: fetchImpl as unknown as typeof fetch,
		});
		expect(fetchImpl).not.toHaveBeenCalled();
	});
});

describe("assinarWebhook com segredo (sanity)", () => {
	test("funciona com segredo não-vazio", () => {
		const sig = assinarWebhook(JSON.stringify(evento), "segredo");
		expect(sig).toMatch(/^[0-9a-f]{64}$/);
	});
});
