import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "#/lib/db/schema";
import { enqueueOutbox } from "#/lib/db/outbox";
import { drainOutbox } from "#/lib/db/outbox";
import type { AtacadoPort } from "#/domain/ports/atacado.port";
import {
	despacharOutbox,
	entregarLinha,
	drenarEEntregar,
	type OutboxPayload,
} from "#/workers/outbox.worker";

function makeDb(): LibSQLDatabase<typeof schema> {
	const dir = join(tmpdir(), `emissor-outbox-${Math.random().toString(36).slice(2)}`);
	mkdirSync(dir, { recursive: true });
	const file = join(dir, "coord.db");
	const db = drizzle({ connection: `file:${file}`, schema });
	migrate(db, { migrationsFolder: "./drizzle" });
	return db;
}

let db: LibSQLDatabase<typeof schema>;

beforeEach(() => {
	db = makeDb();
});
afterEach(() => {
	const dir = (db.$state?.connection?.constructor as any)?.path;
	// best-effort cleanup; tmp dir will be GC'd
});

/** Atacado mock registrador de chamadas. */
function fakeAtacado(): AtacadoPort & { calls: { method: string; args: any[] }[] } {
	const calls: { method: string; args: any[] }[] = [];
	const rec = (method: string) => (...args: any[]) => {
		calls.push({ method, args });
		return Promise.resolve();
	};
	const reject = (method: string, err: Error) => (...args: any[]) => {
		calls.push({ method, args });
		return Promise.reject(err);
	};
	return {
		calls,
		buscarParceiroPorId: rec("buscarParceiroPorId") as any,
		buscarClientesAtivosPorParceiro: rec("buscarClientesAtivosPorParceiro") as any,
		buscarPlanosDeServico: rec("buscarPlanosDeServico") as any,
		buscarFaturaPorChave: rec("buscarFaturaPorChave") as any,
		criarFatura: rec("criarFatura") as any,
		criarCobranca: rec("criarCobranca") as any,
		criarNota: rec("criarNota") as any,
		criarItem: rec("criarItem") as any,
		removerArvore: rec("removerArvore") as any,
		atualizarStatusFatura: rec("atualizarStatusFatura") as any,
		atualizarStatusCobranca: rec("atualizarStatusCobranca") as any,
		atualizarStatusNota: rec("atualizarStatusNota") as any,
		registrarErro: rec("registrarErro") as any,
	} as any;
}

describe("outbox.worker — despacharOutbox (dispatcher)", () => {
	test("atualizarStatusFatura chama atacado.atualizarStatusFatura(id, status)", async () => {
		const atacado = fakeAtacado();
		const payload: OutboxPayload = {
			op: "atualizarStatusFatura",
			id: 10,
			status: "emitindo",
		};
		await despacharOutbox(atacado, payload);
		expect(atacado.calls).toEqual([
			{ method: "atualizarStatusFatura", args: [10, "emitindo"] },
		]);
	});

	test("atualizarStatusCobranca passa status + extra", async () => {
		const atacado = fakeAtacado();
		const extra = { idExterno: "pay_1", linkFatura: "http://x", dataEmissao: "2026-09-01" };
		const payload: OutboxPayload = {
			op: "atualizarStatusCobranca",
			id: 20,
			status: "emitida",
			extra,
		};
		await despacharOutbox(atacado, payload);
		expect(atacado.calls[0]).toEqual({
			method: "atualizarStatusCobranca",
			args: [20, "emitida", extra],
		});
	});

	test("atualizarStatusNota passa id + campos planos", async () => {
		const atacado = fakeAtacado();
		const payload: OutboxPayload = {
			op: "atualizarStatusNota",
			id: 30,
			statusInterno: "emitida",
			situacao: "autorizada",
			chave: "K",
		};
		await despacharOutbox(atacado, payload);
		expect(atacado.calls[0]).toEqual({
			method: "atualizarStatusNota",
			args: [30, { statusInterno: "emitida", situacao: "autorizada", chave: "K" }],
		});
	});

	test("registrarErro passa campos planos (não input aninhado)", async () => {
		const atacado = fakeAtacado();
		const payload: OutboxPayload = {
			op: "registrarErro",
			cobrancaId: 1,
			erro: "BOLETO",
			mensagem: "timeout",
		};
		await despacharOutbox(atacado, payload);
		expect(atacado.calls[0]).toEqual({
			method: "registrarErro",
			args: [{ cobrancaId: 1, erro: "BOLETO", mensagem: "timeout" }],
		});
	});

	test("op desconhecido lança erro", async () => {
		const atacado = fakeAtacado();
		const payload = { op: "desconhecido" } as unknown as OutboxPayload;
		await expect(despacharOutbox(atacado, payload)).rejects.toThrow(/desconhecido/i);
	});
});

describe("outbox.worker — entregarLinha", () => {
	test("entrega com sucesso marca done", async () => {
		const atacado = fakeAtacado();
		await enqueueOutbox(db, {
			aggregate: "fatura",
			aggregateId: 1,
			payload: { op: "atualizarStatusFatura", id: 1, status: "emitindo" },
		});
		const [row] = await drainOutbox(db, 10);
		await entregarLinha(db, atacado, row);
		const rest = await drainOutbox(db, 10);
		expect(rest).toEqual([]);
	});

	test("falha incrementa tentativas e repropaga; linha permanece pending", async () => {
		const atacado = fakeAtacado();
		(atacado.atualizarStatusFatura as any) = async () => {
			atacado.calls.push({ method: "atualizarStatusFatura", args: [1, "emitindo"] });
			throw new Error("Atacado fora");
		};
		await enqueueOutbox(db, {
			aggregate: "fatura",
			aggregateId: 1,
			payload: { op: "atualizarStatusFatura", id: 1, status: "emitindo" },
		});
		const [row] = await drainOutbox(db, 10);
		await expect(entregarLinha(db, atacado, row)).rejects.toThrow("Atacado fora");
		const rest = await drainOutbox(db, 10);
		expect(rest.length).toBe(1);
		expect(rest[0].attempts).toBe(1);
	});
});

describe("outbox.worker — drenarEEntregar", () => {
	test("drena múltiplas linhas de ops distintos e entrega todas", async () => {
		const atacado = fakeAtacado();
		await enqueueOutbox(db, {
			aggregate: "fatura", aggregateId: 1,
			payload: { op: "atualizarStatusFatura", id: 1, status: "emitida" },
		});
		await enqueueOutbox(db, {
			aggregate: "cobranca", aggregateId: 2,
			payload: { op: "atualizarStatusCobranca", id: 2, status: "emitida" },
		});
		await enqueueOutbox(db, {
			aggregate: "nota", aggregateId: 3,
			payload: { op: "atualizarStatusNota", id: 3, statusInterno: "emitida" },
		});
		const entregues = await drenarEEntregar(db, atacado, 10);
		expect(entregues).toBe(3);
		const rest = await drainOutbox(db, 10);
		expect(rest).toEqual([]);
	});

	test("ordem: mais antiga primeiro (por id)", async () => {
		const atacado = fakeAtacado();
		await enqueueOutbox(db, { aggregate: "fatura", aggregateId: 1, payload: { op: "atualizarStatusFatura", id: 1, status: "emitindo" } });
		await enqueueOutbox(db, { aggregate: "fatura", aggregateId: 1, payload: { op: "atualizarStatusFatura", id: 1, status: "emitida" } });
		await drenarEEntregar(db, atacado, 10);
		expect(atacado.calls.map((c) => c.args[1])).toEqual(["emitindo", "emitida"]);
	});

	test("idempotência: entregar a mesma linha duas vezes chama atacado duas vezes (at-least-once) — Atacado é idempotente por id", async () => {
		const atacado = fakeAtacado();
		await enqueueOutbox(db, {
			aggregate: "fatura", aggregateId: 1,
			payload: { op: "atualizarStatusFatura", id: 1, status: "emitida" },
		});
		const [row] = await drainOutbox(db, 10);
		await entregarLinha(db, atacado, row);
		await entregarLinha(db, atacado, row); // replay (at-least-once)
		expect(atacado.calls.length).toBe(2);
	});
});

/**
 * Validação cruzada (revisão CRITICAL): os payloads que o worker de EMISSÃO
 * enfileira (op flat) devem ser despachados pelo RELAY. Este é o contrato que
 * o bug derrotou — emission produz `{op, id, status}` e relay lia `{method,
 * args}`. A regressão garante que as duas metades interoperam.
 */
describe("outbox.worker — interop com o worker de emissão", () => {
	// Payloads idênticos aos que emissao.worker.ts produz (grep enqueueOutbox).
	const payloadsReais = {
		faturaEmitindo: { op: "atualizarStatusFatura", id: 5, status: "emitindo" },
		cobrancaEmitida: {
			op: "atualizarStatusCobranca", id: 42, status: "emitida",
			extra: { idExterno: "pay_9", linkFatura: "http://asaas/9", dataEmissao: "2026-09-10" },
		},
		cobrancaErro: { op: "atualizarStatusCobranca", id: 42, status: "erro" },
		notaAutorizada: {
			op: "atualizarStatusNota", id: 7, statusInterno: "emitida", situacao: "autorizada",
			numero: 123, serie: 1, chave: "K44", protocolo: "P", pdfUrl: "http://pdf", xmlUrl: "http://xml",
		},
		notaErro: { op: "atualizarStatusNota", id: 7, statusInterno: "erro" },
		erroBoleto: { op: "registrarErro", cobrancaId: 42, erro: "BOLETO", mensagem: "timeout" },
		erroNfcom: { op: "registrarErro", notaId: 7, erro: "NFCOM_DEDUP", mensagem: "suspeita" },
		faturaConsolidada: { op: "atualizarStatusFatura", id: 5, status: "parcial" },
	};

	test("cada payload real do worker de emissão é despachado sem 'op desconhecido'", async () => {
		for (const [nome, payload] of Object.entries(payloadsReais)) {
			const atacado = fakeAtacado();
			await despacharOutbox(atacado, payload as OutboxPayload);
			expect(atacado.calls.length).toBeGreaterThanOrEqual(1);
		}
	});

	test("fatura emitindo → atualizarStatusFatura(5, 'emitindo')", async () => {
		const atacado = fakeAtacado();
		await despacharOutbox(atacado, payloadsReais.faturaEmitindo as OutboxPayload);
		expect(atacado.calls[0]).toEqual({ method: "atualizarStatusFatura", args: [5, "emitindo"] });
	});

	test("cobrança emitida → atualizarStatusCobranca com extra", async () => {
		const atacado = fakeAtacado();
		await despacharOutbox(atacado, payloadsReais.cobrancaEmitida as OutboxPayload);
		expect(atacado.calls[0].method).toBe("atualizarStatusCobranca");
		expect(atacado.calls[0].args[0]).toBe(42);
		expect(atacado.calls[0].args[1]).toBe("emitida");
		expect(atacado.calls[0].args[2]).toEqual(payloadsReais.cobrancaEmitida.extra);
	});

	test("nota autorizada → atualizarStatusNota com todos os campos", async () => {
		const atacado = fakeAtacado();
		await despacharOutbox(atacado, payloadsReais.notaAutorizada as OutboxPayload);
		expect(atacado.calls[0].method).toBe("atualizarStatusNota");
		expect(atacado.calls[0].args[0]).toBe(7);
		expect(atacado.calls[0].args[1]).toMatchObject({
			statusInterno: "emitida", situacao: "autorizada", chave: "K44", pdfUrl: "http://pdf",
		});
	});

	test("erro de boleto → registrarErro(cobrancaId)", async () => {
		const atacado = fakeAtacado();
		await despacharOutbox(atacado, payloadsReais.erroBoleto as OutboxPayload);
		expect(atacado.calls[0]).toEqual({
			method: "registrarErro",
			args: [{ cobrancaId: 42, erro: "BOLETO", mensagem: "timeout" }],
		});
	});

	test("erro de nfcom → registrarErro(notaId)", async () => {
		const atacado = fakeAtacado();
		await despacharOutbox(atacado, payloadsReais.erroNfcom as OutboxPayload);
		expect(atacado.calls[0]).toEqual({
			method: "registrarErro",
			args: [{ notaId: 7, erro: "NFCOM_DEDUP", mensagem: "suspeita" }],
		});
	});
});
