/**
 * C4 — Teste ponta-a-ponta do Flow BullMQ real (parent/child + 2ª passada).
 *
 * Contexto: os ~945 testes de emissão passam só com fakes (handlers puros). Este
 * teste exercita o "código de barras" da correção C1/C2/C3: o wiring inteiro do
 * Flow (Worker/getChildrenValues/segunda passada do parent) de ponta a ponta, com
 * Redis REAL e SQLite de coordenação REAL (lease/idempotency/outbox). Os provedores
 * externos (Atacado/Asaas/NFCom) são FAKES — o que importa aqui é a árvore BullMQ +
 * Redis + SQLite.
 *
 * Skip gracioso: se não houver Redis alcançável, o teste é pulado (test.skipIf)
 * com um aviso claro — nunca falha o suite por falta de Redis.
 */
import { describe, expect, mock, test } from "bun:test";
import { JOB_NAMES, QUEUE_NAMES } from "#/lib/queue-names";

// Substitui a env real ANTES de qualquer módulo que importe `#/env` ser carregado
// (imports estáticos são hoisted; os módulos que usam env são importados dinâmicos
// DEPOIS deste mock). Com isso o teste não depende do `.env` local (que tem keys
// vazias: NFCOM_LOGIN/NFCOM_SENHA) nem da DATABASE_URL apontada p/ ./data.
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
		FISCAL_CCLASS_DEFAULT: "0000",
		FISCAL_ICMS_ALIQUOTA: 0,
		LOG_LEVEL: "silent",
	},
}));

import {
	redisDisponivel,
	montarFaturaArvore,
	criarFakeAtacado,
	criarFakeAsaas,
	criarFakeNfcom,
} from "./helpers";
import { mkDb } from "../helpers/db";
import type { AtacadoPort } from "#/domain/ports/atacado.port";
import { drainOutbox } from "#/lib/db/outbox";
import { hasLease } from "#/lib/db/lease";
import { getKey } from "#/lib/db/idempotency";

const REDIS_URL = "redis://localhost:6379";

// Verifica o Redis UMA vez no load do módulo (top-level await). Se indisponível,
// o teste é decorado com skipIf → pula graciosamente SEM falhar o suite.
const redisOk = await redisDisponivel(REDIS_URL);
if (!redisOk) {
	console.warn(
		"Redis não disponível em " +
			REDIS_URL +
			" — teste de integração do Flow pulado; rode com redis:7 para exercitar.",
	);
}

describe("C4 — Flow BullMQ real (parent/child + 2ª passada)", () => {
	// Se o Redis não está disponível, pula graciosamente SEM falhar o suite.
	test.skipIf(!redisOk)(
		"fluxo emit-fatura → emit-cobranca → emit-nfcom consolida a fatura (emitida) e libera lease",
		async () => {
			// Setup: DB SQLite efêmero + fakes.
			const db = await mkDb();
			const fatura = montarFaturaArvore(900, 901, 910);
			const atacado: AtacadoPort = criarFakeAtacado(fatura);
			const asaas = criarFakeAsaas();
			const nfcom = criarFakeNfcom();

			// Wiring BullMQ real (com Redis) — imports dinâmicos após o mock de env.
			const { criarEmissaoWorker } = await import("#/workers/emissao.worker");
			const { getQueue, WORKER_DEFAULTS } = await import("#/lib/queues");

			const workerOut = criarEmissaoWorker({ db, atacado, asaas, nfcom });
			const [worker] = await workerOut.workers;
			// Queue compartilha a MESMA conexão Redis (getRedis singleton) do worker.
			const queue = getQueue(QUEUE_NAMES.EMISSAO);

			try {
				await queue.waitUntilReady();
				await worker.waitUntilReady();

				// Enfileira o JOB PARENT da emissão (SP: `QueuePort.enfileirarEmissaoFatura`
				// faz exatamente `queue.add(EMIT_FATURA, { faturaId })`).
				const job = await queue.add(JOB_NAMES.EMIT_FATURA, { faturaId: 900 }, WORKER_DEFAULTS);
				const jobId = job.id ?? "";

				// Aguarda a árvore COMPLETA: o parent só fica `completed` quando TODOS os
				// children transitivos resolvem (ADR-0002) — ou seja, a 2ª passada do
				// parent (consolidação) JÁ ocorreu quando `getJob` devolve completed.
				const estado = await aguardarJobFinal(queue, jobId, 15_000);
				expect(estado, `job emit-fatura deveria completar; estado=${estado}`).toBe("completed");

				// 1) Fatura consolidada p/ `emitida` via outbox (2ª passada do parent).
				const msgs = await drainOutbox(db, 50);
				const faturaEmitida = msgs.some(
					(m) =>
						(m.payload as any).op === "atualizarStatusFatura" &&
						(m.payload as any).status === "emitida",
				);
				expect(faturaEmitida, "outbox deve ter fatura emitida (2ª passada)").toBe(true);

				// 2) Cobrança `emitida` via outbox (1ª passada do child).
				const cobrancaEmitida = msgs.some(
					(m) =>
						(m.payload as any).op === "atualizarStatusCobranca" &&
						(m.payload as any).status === "emitida",
				);
				expect(cobrancaEmitida, "outbox deve ter cobrança emitida").toBe(true);

				// 3) Nota `emitida` via outbox (child emit-nfcom).
				const notaEmitida = msgs.some(
					(m) =>
						(m.payload as any).op === "atualizarStatusNota" &&
						(m.payload as any).statusInterno === "emitida",
				);
				expect(notaEmitida, "outbox deve ter nota emitida").toBe(true);

				// 4) Lease LIBERADO: fatura_lease SEM a row (2ª passada do parent faz release).
				const lease = await hasLease(db, 900);
				expect(lease, "lease deve estar liberado após consolidação").toBe(false);

				// 5) Idempotency keys resolvidas (boleto + nota).
				const boletoKey = await getKey(db, "cobranca:901:boleto");
				expect(boletoKey?.status, "key do boleto deve estar resolved").toBe("resolved");
				const notaKey = await getKey(db, "nfcom:910:emitir");
				expect(notaKey?.status, "key da nota deve estar resolved").toBe("resolved");
			} finally {
				await worker.close();
			}
		},
	);
});

/** Polia o job até `completed` ou `failed`, com timeout; devolve o estado final. */
async function aguardarJobFinal(
	queue: import("bullmq").Queue,
	jobId: string,
	timeoutMs: number,
): Promise<string | undefined> {
	const inicio = Date.now();
	while (Date.now() - inicio < timeoutMs) {
		const job = await queue.getJob(jobId);
		const state = await job?.getState();
		if (state === "completed" || state === "failed") return state;
		await new Promise((r) => setTimeout(r, 200));
	}
	return "timeout";
}
