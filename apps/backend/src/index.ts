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
import { getDb } from "@emissor/db/client";
import { getRedis } from "#/lib/redis";
import { getQueue, WORKER_DEFAULTS, gracefulShutdown } from "#/lib/queues";
import { QUEUE_NAMES, JOB_NAMES } from "#/lib/queue-names";
import { createRateLimiter, wrapWithRateLimit } from "#/lib/rate-limit";
import { criarApp } from "#/http/server";
import { createAtacadoClient } from "#/modules/atacado/atacado.client";
import { createAuthNocoBaseClient } from "#/modules/atacado/translators/auth";
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
		// Nível do logger real (ADR-0008): o singleton nasce em `info`; o composition
		// root aplica env.LOG_LEVEL. `debug`/`trace` também ligam o detalhe de
		// ERRO_INTERNO na resposta HTTP (error-handler, abaixo).
		log.level = env.LOG_LEVEL;
		log.debug({ nivel: env.LOG_LEVEL }, "LOG_LEVEL aplicado ao logger");

		log.info({ port: env.PORT }, "iniciando emissor-nfcom");

		// 1. DB de coordenação + migrate (idempotente, ADR-0009).
		const db = getDb();
		await migrate(db, { migrationsFolder: "./drizzle" });
		log.info("migrations aplicadas");

		// 2. Redis (BullMQ).
		const redis = getRedis();

		// 3. Repositories (ACLs — ADR-0004). Env ligado aqui (lazy nos clients).
		// Rate-limit por gateway (ADR-0002): cada provedor respeita a sua env
		// (RATE_LIMIT_ASAAS/NFCOM/ATACADO) no nível da CHAMADA EXTERNA — a árvore
		// BullMQ Flows vive numa única fila `emissao` (parent/child na mesma fila),
		// então o limite não pode ser por fila. O proxy serializa cada método da
		// porta pelo limiter do provedor (src/lib/rate-limit.ts).
		const atacadoClient = createAtacadoClient();
		const atacado: AtacadoPort = wrapWithRateLimit(
			new AtacadoRepository(atacadoClient),
			createRateLimiter(env.RATE_LIMIT_ATACADO),
		);
		const asaasClient = createAsaasClient();
		const asaas: AsaasPort = wrapWithRateLimit(
			new AsaasRepository(asaasClient),
			createRateLimiter(env.RATE_LIMIT_ASAAS),
		);
		const nfcomClient = criarNfcomClient();
		const nfcom: NfcomPort = wrapWithRateLimit(
			criarNfcomRepository({
				client: nfcomClient,
				credenciais: { login: env.NFCOM_LOGIN, senha: env.NFCOM_SENHA },
			}),
			createRateLimiter(env.RATE_LIMIT_NFCOM),
		);

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
		// Painel de visualização (opcional): o `PAINEL_COOKIE_SECRET` ausente
		// desliga o painel (o server não monta /painel) — não quebra o deploy.
		const authNocoBase = createAuthNocoBaseClient();
		const app = criarApp({
			atacado,
			queue,
			apiKey: env.EMISSOR_API_KEY,
			db,
			defaultsFiscais: {
				cfop: env.FISCAL_CFOP_DEFAULT,
				cclass: env.FISCAL_CCLASS_DEFAULT,
				aliqIcms: env.FISCAL_ICMS_ALIQUOTA,
			},
			// Fallback de IE p/ destinatário isento (Defeito B) — opcional na env.
			ieIsento: env.FISCAL_IE_ISENTO,
			// Painel de visualização (login NocoBase + cookie assinado).
			painelCookieSecret: env.PAINEL_COOKIE_SECRET,
			authNocoBase,
			nocobaseAuthenticator: env.NOCOBASE_AUTHENTICATOR,
			// LOG_LEVEL=debug/trace → detalhe de ERRO_INTERNO na resposta (diagnóstico).
			logLevel: env.LOG_LEVEL,
		});

		// 6. Workers (mesmo processo, single-instance — ADR-0002).
		const emissaoWorkers = criarEmissaoWorker({
			atacado,
			asaas,
			nfcom,
			db,
			// QueuePort compartilhada p/ enfileirar eventos de webhook a cada mudança
			// de estado (C3). WEBHOOK_URL vazia → no-op (caso 14).
			queue,
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


