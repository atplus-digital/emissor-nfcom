/**
 * SPEC-0001 caso 2: job `emit-fatura` órfão (crash) — novo job adquire o lease
 * `fatura:{id}:emitir` e reassume; cobranças/notas já emitidas são puladas pelas
 * idempotency keys filhas.
 */
import { describe, expect, mock, test } from "bun:test";
import type { AtacadoPort } from "#/domain/ports/atacado.port";
import { handleEmitFatura } from "#/workers/emissao.worker";
import { mkDb } from "../helpers/db";

describe("SPEC-0001 caso 2 — orphan lease reassume", () => {
	test("lease livre → adquire, marca emitindo, fan-out cobranças a-emitir", async () => {
		const db = await mkDb();
		const fatura = {
			id: 500, parceiroId: 1, dataReferencia: "2026-08-01", dataVencimento: "2026-09-10",
			valorTotal: 10000, tipoFaturamento: "parceiro" as const, status: "a-emitir",
			cobrancas: [
				{ id: 501, faturaId: 500, valorTotal: 10000, nomeDevedor: "p", documentoDevedor: "1", emailDevedor: "e", status: "a-emitir" as const, dataVencimento: "2026-09-10", notas: [] },
				{ id: 502, faturaId: 500, valorTotal: 5000, nomeDevedor: "p", documentoDevedor: "1", emailDevedor: "e", status: "emitida" as const, dataVencimento: "2026-09-10", notas: [] },
			],
		};
		const atacado = {
			getFaturaPorId: mock(() => Promise.resolve(fatura)),
		} as unknown as AtacadoPort;
		const enqueued: string[] = [];
		const res = await handleEmitFatura(
			{ data: { faturaId: 500, parceiroId: 1, dataReferencia: "2026-08-01" }, attemptsMade: 0, opts: {} } as any,
			{ db, atacado, asaas: {} as any, nfcom: {} as any, enqueueFilho: async (name) => { enqueued.push(name); } },
		);
		// só a cobrança a-emitir (501) é enfileirada; a 502 (emitida) é pulada
		expect(enqueued.filter((n) => n === "emit-cobranca").length).toBe(1);
		expect(res.enfileiradas).toBe(1);
		const { drainOutbox } = await import("@emissor/db/outbox");
		const msgs = await drainOutbox(db, 10);
		expect(msgs.some((m) => (m.payload as any).op === "atualizarStatusFatura" && (m.payload as any).status === "emitindo")).toBe(true);
	});

	test("lease já ativo → não reassume, pulando (outro job detém)", async () => {
		const db = await mkDb();
		const { acquireLease } = await import("@emissor/db/lease");
		await acquireLease(db, 501); // lease já detido
		const atacado = { getFaturaPorId: mock(() => Promise.resolve(null)) } as unknown as AtacadoPort;
		const enqueued: string[] = [];
		const res = await handleEmitFatura(
			{ data: { faturaId: 501, parceiroId: 1, dataReferencia: "2026-08-01" }, attemptsMade: 0, opts: {} } as any,
			{ db, atacado, asaas: {} as any, nfcom: {} as any, enqueueFilho: async (name) => { enqueued.push(name); } },
		);
		expect(res.enfileiradas).toBe(0);
		expect(enqueued.length).toBe(0);
	});

	test("lease stale (job morto sem release) → reassume e prossegue (caso 2)", async () => {
		const db = await mkDb();
		const { faturaLease } = await import("@emissor/db/schema");
		// Insere um lease stale (emitindo_since há 10 min — bem além do limiar de 3 min).
		const stale = new Date(Date.now() - 10 * 60 * 1000).toISOString();
		await db.insert(faturaLease).values({ faturaId: 510, emitindoSince: stale });
		const fatura = {
			id: 510, parceiroId: 1, dataReferencia: "2026-08-01", dataVencimento: "2026-09-10",
			valorTotal: 10000, tipoFaturamento: "parceiro" as const, status: "a-emitir",
			cobrancas: [
				{ id: 511, faturaId: 510, valorTotal: 10000, nomeDevedor: "p", documentoDevedor: "1", emailDevedor: "e", status: "a-emitir" as const, dataVencimento: "2026-09-10", notas: [] },
			],
		};
		const atacado = { getFaturaPorId: mock(() => Promise.resolve(fatura)) } as unknown as AtacadoPort;
		const enqueued: string[] = [];
		const res = await handleEmitFatura(
			{ data: { faturaId: 510, parceiroId: 1, dataReferencia: "2026-08-01" }, attemptsMade: 0, opts: {} } as any,
			{ db, atacado, asaas: {} as any, nfcom: {} as any, limiteLeaseStaleMs: 3 * 60 * 1000, enqueueFilho: async (name) => { enqueued.push(name); } },
		);
		// reassumiu: enfileirou a cobrança a-emitir (não pulou)
		expect(res.enfileiradas).toBe(1);
		expect(enqueued.filter((n) => n === "emit-cobranca").length).toBe(1);
	});
});
