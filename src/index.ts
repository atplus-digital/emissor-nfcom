/**
 * Composition root + entrypoint do emissor-nfcom (ADR-0007).
 *
 * Único ponto que importa `#/env` no top-level (valida config e falha cedo).
 * Monta: logger (singleton), DB (drizzle, migrate no boot), Redis, repositories
 * (Atacado/Asaas/NFCom), QueuePort (BullMQ), app Hono (rotas + middlewares) e
 * workers (emissão/outbox/webhook) — tudo no MESMO processo single-instance
 * (ADR-0002). Graceful shutdown 30s no SIGTERM/SIGINT (ADR-0002).
 *
 * Ordem: env → migrate DB → redis → repositories → queue → app → workers → listen.
 */
import { serve } from "bun";
import { migrate } from "drizzle-orm/libsql/migrator";
import { env } from "#/env";
import { log, runWithLogContext } from "#/lib/logger";
import { getDb } from "#/lib/db/client";
import { getRedis } from "#/lib/redis";
import { getQueue, WORKER_DEFAULTS, gracefulShutdown } from "#/lib/queues";
import { QUEUE_NAMES, JOB_NAMES } from "#/lib/queue-names";
import { criarApp } from "#/http/server";
import { createAtacadoClient } from "#/modules/atacado/atacado.client";
import { AtacadoRepository } from "#/modules/atacado/atacado.repository";
import { createAsaasClient } from "#/modules/asaas/asaas.client";
import { AsaasRepository } from "#/modules/asaas/asaas.repository";
import { criarNfcomClient } from "#/modules/nfcom/nfcom.client";
import { criarNfcomRepository } from "#/modules/nfcom/nfcom.repository";
import { criarEmissaoWorker } from "#/workers/emissao.worker";
import { criarOutboxWorker } from "#/workers/outbox.worker";
import { criarWebhookWorker, enfileirarWebhook } from "#/workers/webhook.worker";
import type { QueuePort } from "#/domain/ports/queue.port";
import type { AtacadoPort } from "#/domain/ports/atacado.port";
import type { AsaasPort } from "#/domain/ports/asaas.port";
import type { NfcomPort } from "#/domain/ports/nfcom.port";
import type { EventoWebhook } from "#/domain/types";

async function main() {
	await runWithLogContext({ fila: "boot" }, async () => {
		log.info({ port: env.PORT }, "iniciando emissor-nfcom");

		// 1. DB de coordenação + migrate (idempotente, ADR-0009).
		const db = getDb();
		await migrate(db, { migrationsFolder: "./drizzle" });
		log.info("migrations aplicadas");

		// 2. Redis (BullMQ).
		const redis = getRedis();

		// 3. Repositories (ACLs — ADR-0004). Env ligado aqui (lazy nos clients).
		const atacadoClient = createAtacadoClient();
		const atacado: AtacadoPort = new AtacadoRepository(atacadoClient);
		const asaasClient = createAsaasClient();
		const asaas: AsaasPort = new AsaasRepository(asaasClient);
		const nfcomClient = criarNfcomClient();
		const nfcom: NfcomPort = criarNfcomRepository({
			client: nfcomClient,
			credenciais: { login: env.NFCOM_LOGIN, senha: env.NFCOM_SENHA },
		});

		// 4. QueuePort: enfileira emissão de fatura + webhook (SPEC-0001).
		const queue: QueuePort = {
			async enfileirarEmissaoFatura(faturaId: number) {
				const job = await getQueue(QUEUE_NAMES.EMISSAO).add(
					JOB_NAMES.EMIT_FATURA,
					{ faturaId },
					{ ...WORKER_DEFAULTS },
				);
				return { jobId: job.id ?? "" };
			},
			async enfileirarWebhook(evento: EventoWebhook) {
				await enfileirarWebhook(evento, {
					url: env.WEBHOOK_URL,
					secret: env.WEBHOOK_SECRET,
				});
			},
		};

		// 5. App Hono (rotas + middlewares). Defaults fiscais injetados (ADR-0004).
		const app = criarApp({
			atacado,
			queue,
			apiKey: env.EMISSOR_API_KEY,
			defaultsFiscais: {
				cfop: env.FISCAL_CFOP_DEFAULT,
				cclass: env.FISCAL_CCLASS_DEFAULT,
				aliqIcms: env.FISCAL_ICMS_ALIQUOTA,
			},
		});

		// 6. Workers (mesmo processo, single-instance — ADR-0002).
		const emissaoWorkers = criarEmissaoWorker({
			atacado,
			asaas,
			nfcom,
			db,
		});
		const outboxFactory = criarOutboxWorker({ atacado, db });
		// Agenda o poll do outbox (repeat job a cada 5s — ADR-0002).
		await outboxFactory.repair();
		const outboxWorker = await outboxFactory.worker;
		const webhookWorker = await criarWebhookWorker({
			config: { url: env.WEBHOOK_URL, secret: env.WEBHOOK_SECRET },
		});

		// 7. HTTP server.
		const server = serve({
			port: env.PORT,
			fetch: app.fetch,
		});
		log.info({ port: env.PORT }, "server ouvindo");

		// 8. Graceful shutdown (ADR-0002: 30s drena jobs em andamento).
		const shutdown = async (sig: string) => {
			log.info({ sig }, "shutdown iniciado");
			const workers = await Promise.resolve(emissaoWorkers.workers).catch(() => []);
			await gracefulShutdown([...workers, webhookWorker, outboxWorker], 30_000);
			server.stop(true);
			await redis.quit().catch(() => {});
			log.info("shutdown concluído");
			process.exit(0);
		};
		process.on("SIGTERM", () => void shutdown("SIGTERM"));
		process.on("SIGINT", () => void shutdown("SIGINT"));
	});
}

main().catch((err) => {
	log.error({ err }, "erro fatal no boot");
	process.exit(1);
});
