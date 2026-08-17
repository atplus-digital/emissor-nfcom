/**
 * Testes do worker de webhook (SPEC-0001 passo 6) — entrega e idempotência.
 *
 * Casos: 12 (não-2xx → retry), 13 (eventoId determinístico p/ dedup no receptor).
 * TDD: vermelho (módulo ausente) → verde.
 */
import { describe, expect, mock, test } from "bun:test";
import {
	assinarWebhook,
	calcularEventoId,
	enviarWebhook,
} from "#/workers/webhook.worker";
import type { EventoWebhook } from "#/domain/types";

const eventoBase: EventoWebhook = {
	eventoId: "",
	faturaId: 123,
	tipo: "fatura.status",
	alvo: { faturaId: 123 },
	estado: "emitida",
	timestamp: "2026-08-17T12:00:00Z",
};

describe("calcularEventoId (SPEC-0001 caso 13 — determinístico)", () => {
	test("mesmo (faturaId, alvo, estado, timestamp) → mesmo eventoId", () => {
		const a = calcularEventoId({
			...eventoBase,
			alvo: { faturaId: 123, cobrancaId: 456 },
		});
		const b = calcularEventoId({
			...eventoBase,
			alvo: { cobrancaId: 456, faturaId: 123 }, // ordem de chaves trocada
		});
		expect(a).toBe(b);
		expect(a).toMatch(/^[0-9a-f]{64}$/); // SHA-256 hex
	});

	test("timestamp diferente → eventoId diferente", () => {
		const a = calcularEventoId({ ...eventoBase, timestamp: "2026-08-17T12:00:00Z" });
		const b = calcularEventoId({ ...eventoBase, timestamp: "2026-08-17T12:00:01Z" });
		expect(a).not.toBe(b);
	});

	test("estado diferente → eventoId diferente", () => {
		const a = calcularEventoId({ ...eventoBase, estado: "emitida" });
		const b = calcularEventoId({ ...eventoBase, estado: "parcial" });
		expect(a).not.toBe(b);
	});

	test("não depende de eventoId ou erros (estável entre retries)", () => {
		const semErros = calcularEventoId({ ...eventoBase, erros: undefined });
		const comErros = calcularEventoId({
			...eventoBase,
			erros: [{ cobrancaId: 789, tipo: "RETRYABLE", mensagem: "x" }],
		});
		// erros não fazem parte da chave determinística (faturaId,alvo,estado,timestamp)
		expect(semErros).toBe(comErros);
	});
});

describe("assinarWebhook (HMAC X-Webhook-Signature)", () => {
	test("HMAC-SHA256 hex do corpo com o segredo", async () => {
		const corpo = JSON.stringify(eventoBase);
		const sig = assinarWebhook(corpo, "segredo");
		expect(sig).toMatch(/^[0-9a-f]{64}$/);
		// verifica manualmente com node:crypto
		const { createHmac } = await import("node:crypto");
		const esperado = createHmac("sha256", "segredo").update(corpo).digest("hex");
		expect(sig).toBe(esperado);
	});

	test("segredo diferente → assinatura diferente", () => {
		const corpo = "x";
		expect(assinarWebhook(corpo, "a")).not.toBe(assinarWebhook(corpo, "b"));
	});
});

describe("enviarWebhook (SPEC-0001 caso 12 — não-2xx → throw/retry)", () => {
	test("2xx → resolve e envia body JSON + header X-Webhook-Signature", async () => {
		const fetchImpl = mock((_url: unknown, _init?: unknown) =>
			Promise.resolve({ ok: true, status: 200 } as Response),
		);
		const evento = { ...eventoBase, eventoId: "id-1" };
		await enviarWebhook(evento, {
			url: "https://cliente.example/hook",
			secret: "segredo",
			fetchImpl: fetchImpl as unknown as typeof fetch,
		});
		expect(fetchImpl).toHaveBeenCalledTimes(1);
		const [_url, init] = fetchImpl.mock.calls[0] as [unknown, RequestInit];
		expect(init?.method).toBe("POST");
		const body = String(init?.body);
		expect(JSON.parse(body)).toEqual(evento);
		expect(init?.headers).toMatchObject({
			"X-Webhook-Signature": assinarWebhook(body, "segredo"),
			"Content-Type": "application/json",
		});
	});

	test("500 → throw (BullMQ retenta; caso 12)", async () => {
		const fetchImpl = mock(() =>
			Promise.resolve({ ok: false, status: 500 } as Response),
		);
		await expect(
			enviarWebhook(eventoBase, {
				url: "https://cliente.example/hook",
				secret: "segredo",
				fetchImpl: fetchImpl as unknown as typeof fetch,
			}),
		).rejects.toThrow();
		expect(fetchImpl).toHaveBeenCalledTimes(1);
	});

	test("fetch rejeita (cliente caiu) → throw (caso 12)", async () => {
		const fetchImpl = mock(() => Promise.reject(new Error("ECONNREFUSED")));
		await expect(
			enviarWebhook(eventoBase, {
				url: "https://cliente.example/hook",
				secret: "segredo",
				fetchImpl: fetchImpl as unknown as typeof fetch,
			}),
		).rejects.toThrow("ECONNREFUSED");
	});
});
