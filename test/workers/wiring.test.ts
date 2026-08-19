/**
 * Wiring BullMQ real (Redis) dos workers de webhook e outbox.
 *
 * O wiring (criarWebhookWorker/enfileirarWebhook com url setada e criarOutboxWorker)
 * precisa de um Redis REAL — fora do escopo dos unit tests com fakes. Este arquivo
 * exercita só a "camada fina" do BullMQ: enfileirar → processar → concluir, e o
 * agendamento do poll do outbox. O fluxo completo de emissão já é coberto por
 * flow.test.ts.
 *
 * Skip gracioso: sem Redis alcançável, pula SEM falhar o suite (test.skipIf).
 */
import { describe, expect, test, afterAll, mock } from "bun:test";
import { JOB_NAMES, QUEUE_NAMES } from "#/lib/queue-names";

// Env mockada ANTES de qualquer módulo que toque `#/env` (imports estáticos são
// hoisted; os módulos que usam env são importados dinâmicos DEPOIS deste mock).
mock.module("#/env", () => ({
	env: {
		REDIS_URL: "redis://localhost:6379",
		DATABASE_URL: ":memory:",
		EMISSOR_API_KEY: "test",
		RATE_LIMIT_ASAAS: 100,
		RATE_LIMIT_NFCOM: 100,
		RATE_LIMIT_ATACADO: 100,
		NOCOBASE_API_URL: "https://example.com/api",
		NOCOBASE_API_KEY: "test",
		NFCOM_API_URL: "https://example.com",
		NFCOM_LOGIN: "test",
		NFCOM_SENHA: "test",
		ASAAS_API_URL: "https://example.com",
		ASAAS_API_KEY: "test",
		FISCAL_CFOP_DEFAULT: "6307",
		FISCAL_CCLASS_DEFAULT: "0100201",
		FISCAL_ICMS_ALIQUOTA: 0,
		WEBHOOK_URL: "",
		WEBHOOK_SECRET: "",
		LOG_LEVEL: "silent",
	},
}));

import { redisDisponivel, criarFakeAtacado, montarFaturaArvore } from "../integration/helpers";
import { mkDb } from "../helpers/db";

const REDIS_URL = "redis://localhost:6379";

const redisOk = await redisDisponivel(REDIS_URL);
if (!redisOk) {
	console.warn(
		"Redis não disponível em " + REDIS_URL + " — wiring tests pulados; rode com redis:7.",
	);
}

/** EventoWebhook válido (mesmo shape base de test/webhook/delivery.test.ts). */
function eventoWebhookBase() {
	return {
		eventoId: "",
		faturaId: 123,
		tipo: "fatura.status" as const,
		alvo: { faturaId: 123 },
		estado: "emitida",
		// timestamp único por execução → eventoId determinístico diferente → sem
		// colisão de dedup (jobId=eventoId) com jobs de execuções anteriores no Redis.
		timestamp: new Date().toISOString(),
	};
}

/** Receptor fake: um servidor HTTP local que captura o POST do webhook. */
let server: ReturnType<typeof Bun.serve> | undefined;
let recebidos: any[] = [];

describe("wiring webhook — criarWebhookWorker + enfileirarWebhook (Redis real)", () => {

	test.skipIf(!redisOk)(
		"enfileirarWebhook com url setada entrega o evento ao receptor e o job completa",
		{ timeout: 30_000 },
		async () => {
			recebidos = [];
			server = Bun.serve({
				port: 0,
				fetch: async (req) => {
					const body = await req.text();
					recebidos.push({ body: JSON.parse(body), sig: req.headers.get("X-Webhook-Signature") });
					return new Response("ok", { status: 200 });
				},
			});
			const url = `http://127.0.0.1:${server.port}/hook`;

			// Wiring real com Redis (imports dinâmicos após o mock de env).
			const { criarWebhookWorker, enfileirarWebhook } = await import("#/workers/webhook.worker");
			const { getQueue } = await import("#/lib/queues");

			const worker = await criarWebhookWorker({
				config: { url, secret: "segredo" },
			});
			const queue = getQueue(QUEUE_NAMES.WEBHOOK);

			try {
				await queue.waitUntilReady();
				await worker.waitUntilReady();

				await enfileirarWebhook(eventoWebhookBase(), { url, secret: "segredo" });

				// Espera o job ser processado até o receptor capturar o POST.
				let jobState: string | undefined;
				const inicio = Date.now();
				while (Date.now() - inicio < 10_000) {
					if (recebidos.length > 0) break;
					await new Promise((r) => setTimeout(r, 150));
				}

				expect(recebidos.length, "receptor deveria receber o POST").toBe(1);
				const recebido = recebidos[0];
				// eventoId determinístico preenchido automaticamente (calcularEventoId).
				expect(recebido.body.eventoId).toMatch(/^[0-9a-f]{64}$/);
				expect(recebido.body.faturaId).toBe(123);
				expect(recebido.body.estado).toBe("emitida");
				// HMAC assinado com o segredo.
				expect(recebido.sig).toMatch(/^[0-9a-f]{64}$/);

				// O job deve ter concluído (estado `completed` no BullMQ).
				const job = await queue.getJob(recebido.body.eventoId);
				jobState = await job?.getState();
				expect(jobState).toBe("completed");
			} finally {
				await worker.close();
				server?.stop();
				server = undefined;
			}
		},
	);

	test.skipIf(!redisOk)(
		"enfileirarWebhook com url vazia é no-op (caso 14 — nenhum job adicionado)",
		{ timeout: 30_000 },
		async () => {
			const { enfileirarWebhook } = await import("#/workers/webhook.worker");
			const { getQueue } = await import("#/lib/queues");
			const queue = getQueue(QUEUE_NAMES.WEBHOOK);

			// url vazia → enfileirarWebhook retorna sem add (caso 14).
			const countAntes = await queue.count();
			await enfileirarWebhook(eventoWebhookBase(), { url: "", secret: "" });
			const countDepois = await queue.count();

			// Nenhum job novo deve ter sido criado pelo no-op.
			expect(countDepois).toBe(countAntes);
		},
	);
});

describe("wiring outbox — criarOutboxWorker (Redis real)", () => {
	test.skipIf(!redisOk)(
		"criarOutboxWorker + repair agendam o repeat job outbox-relay",
		{ timeout: 30_000 },
		async () => {
			const db = await mkDb();
			const fatura = montarFaturaArvore(901, 902, 910);
			const atacado = criarFakeAtacado(fatura);

			const { criarOutboxWorker } = await import("#/workers/outbox.worker");
			const { getQueue } = await import("#/lib/queues");

			const out = criarOutboxWorker({ atacado, db });
			await out.repair();
			const worker = await out.worker;
			const queue = getQueue(QUEUE_NAMES.OUTBOX);

			try {
				await queue.waitUntilReady();
				await worker.waitUntilReady();

				// O scheduler (repeat job) deve existir após o repair.
				const scheduler = await queue.getJobScheduler(JOB_NAMES.OUTBOX_RELAY);
				expect(scheduler).toBeTruthy();
				expect(scheduler?.name).toBe(JOB_NAMES.OUTBOX_RELAY);
			} finally {
				await worker.close();
			}
		},
	);
});

afterAll(async () => {
	server?.stop();
	server = undefined;
	const { getRedis } = await import("#/lib/redis");
	getRedis().disconnect();
});
