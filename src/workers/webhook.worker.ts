/**
 * Worker de webhook de saída (SPEC-0001 passo 6, ADR-0002).
 *
 * Empurra `POST {WEBHOOK_URL}` ao endpoint do cliente a cada mudança de estado
 * relevante da fatura/cobrança/nota. Entrega **ao-menos-uma-vez**, idempotente:
 * o `eventoId` é **determinístico** por `(faturaId, alvo, estado, timestamp-do-evento)`
 * — estável entre retries, para o cliente dedup (SPEC-0001 caso 13).
 *
 * Autenticação: header `X-Webhook-Signature` = HMAC-SHA256 do corpo com
 * `WEBHOOK_SECRET` (CONVENTIONS.md · Autorização).
 *
 * - `WEBHOOK_URL` vazia → não empurra (caso 14).
 * - cliente não-2xx ou queda → throw; BullMQ retenta com backoff
 *   (WORKER_DEFAULTS); exaurido, o job fica `failed` e o cliente reconsulta via
 *   `GET /faturas/{id}/emissao` (caso 12).
 *
 * Config injetável (url/secret/fetch) para não disparar validação de env em
 * testes; o composition root (Fase 6) liga `env.WEBHOOK_*`.
 */
import { createHmac } from "node:crypto";
import { createHash } from "node:crypto";
import { log, runWithLogContext } from "#/lib/logger";
import type { EventoWebhook } from "#/domain/types";

// BullMQ/queues/env carregados LENTAMENTE (dynamic import) só nas funções que
// tocam Redis — manter as funções puras (calcularEventoId/assinarWebhook/
// enviarWebhook/handleWebhookSend) livres de `env` p/ não disparar validação
// de env em testes unitários.
import type { Job } from "bullmq";

/** Tipo mínimo de Job p/ handleWebhookSend (desacoplado de bullmq runtime). */
interface JobLike {
	id?: string;
	data: EventoWebhook;
}

/** Campos que formam a chave determinística do evento (SPEC-0001 caso 13). */
function chaveDeterministica(evento: {
	faturaId: number;
	alvo: EventoWebhook["alvo"];
	estado: string;
	timestamp: string;
}): string {
	// Serialização estável: chaves do `alvo` ordenadas (ordem de inserção não
	// pode afetar o hash).
	const alvoOrdenado: Record<string, number> = {};
	for (const k of Object.keys(evento.alvo).sort()) {
		const v = evento.alvo[k as keyof EventoWebhook["alvo"]];
		if (typeof v === "number") alvoOrdenado[k] = v;
	}
	return JSON.stringify({
		faturaId: evento.faturaId,
		alvo: alvoOrdenado,
		estado: evento.estado,
		timestamp: evento.timestamp,
	});
}

/**
 * `eventoId` determinístico por `(faturaId, alvo, estado, timestamp-do-evento)`
 * (SPEC-0001 passo 6). SHA-256 hex da serialização estável. **Não** depende do
 * `eventoId` de entrada nem de `erros` — estável entre retries do sistema.
 */
export function calcularEventoId(evento: {
	faturaId: number;
	alvo: EventoWebhook["alvo"];
	estado: string;
	timestamp: string;
}): string {
	return createHash("sha256").update(chaveDeterministica(evento)).digest("hex");
}

/**
 * HMAC-SHA256 do corpo com o `WEBHOOK_SECRET` → hex (header
 * `X-Webhook-Signature`). CONVENTIONS.md · Autorização.
 */
export function assinarWebhook(corpo: string, secret: string): string {
	return createHmac("sha256", secret).update(corpo).digest("hex");
}

export interface WebhookConfig {
	url: string;
	secret: string;
	/** fetch injetável p/ testes (sem rede real). */
	fetchImpl?: typeof fetch;
}

/**
 * Envia um evento ao webhook do cliente. `url` vazia → **no-op** (caso 14).
 * Resposta não-2xx ou erro de rede → throw (BullMQ retenta; caso 12).
 */
export async function enviarWebhook(
	evento: EventoWebhook,
	config: WebhookConfig,
): Promise<void> {
	const { url, secret } = config;
	if (!url) return; // caso 14 — sem URL configurada, não empurra

	const fetchImpl = config.fetchImpl ?? fetch;
	const corpo = JSON.stringify(evento);
	const assinatura = assinarWebhook(corpo, secret);

	const resp = await fetchImpl(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"X-Webhook-Signature": assinatura,
		},
		body: corpo,
	});

	if (!resp.ok) {
		throw new Error(
			`webhook não-2xx: status=${resp.status} faturaId=${evento.faturaId} estado=${evento.estado}`,
		);
	}
}

export interface WebhookWorkerDeps {
	config: WebhookConfig;
	/** Factory injetável p/ testes. */
}

/** Handler puro (job.data = EventoWebhook) — testável sem Worker real. */
export async function handleWebhookSend(
	job: JobLike,
	deps: WebhookWorkerDeps,
): Promise<void> {
	const evento = job.data;
	await runWithLogContext({ fila: "webhook", jobId: job.id ?? "" }, async () => {
		log.info({ faturaId: evento.faturaId, estado: evento.estado }, "webhook: enviando");
		await enviarWebhook(evento, deps.config);
		log.info({ faturaId: evento.faturaId, estado: evento.estado }, "webhook: entregue");
	});
}

/** Cria o Worker BullMQ na fila `webhook` (composition root — Fase 6). */
export async function criarWebhookWorker(
	deps: WebhookWorkerDeps,
): Promise<import("bullmq").Worker> {
	const [{ Worker }, { getQueue }, { QUEUE_NAMES }] = await Promise.all([
		import("bullmq"),
		import("#/lib/queues"),
		import("#/lib/queue-names"),
	]);
	return new Worker(QUEUE_NAMES.WEBHOOK, async (job: Job) => handleWebhookSend(job, deps));
}

/** Enfileira um evento de webhook na fila `webhook`. */
export async function enfileirarWebhook(
	evento: EventoWebhook,
	config: WebhookConfig,
): Promise<void> {
	if (!config.url) return; // caso 14
	const eventoComId: EventoWebhook = {
		...evento,
		eventoId: evento.eventoId || calcularEventoId(evento),
	};
	const [{ getQueue }, { QUEUE_NAMES, JOB_NAMES }, { WORKER_DEFAULTS }] = await Promise.all([
		import("#/lib/queues"),
		import("#/lib/queue-names"),
		import("#/lib/queues"),
	]);
	await getQueue(QUEUE_NAMES.WEBHOOK).add(JOB_NAMES.WEBHOOK_SEND, eventoComId, {
		jobId: eventoComId.eventoId, // dedup no BullMQ por eventoId (idempotência de entrega)
		attempts: WORKER_DEFAULTS.attempts,
		backoff: WORKER_DEFAULTS.backoff,
	});
}
