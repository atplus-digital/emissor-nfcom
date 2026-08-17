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
			method: "atualizarStatusFatura",
			args: { id: 10, status: "emitindo" },
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
			method: "atualizarStatusCobranca",
			args: { id: 20, status: "emitida", extra },
		};
		await despacharOutbox(atacado, payload);
		expect(atacado.calls[0]).toEqual({
			method: "atualizarStatusCobranca",
			args: [20, "emitida", extra],
		});
	});

	test("atualizarStatusNota passa id + input", async () => {
		const atacado = fakeAtacado();
		const input = { statusInterno: "emitida", situacao: "autorizada", chave: "K" };
		const payload: OutboxPayload = {
			method: "atualizarStatusNota",
			args: { id: 30, input },
		};
		await despacharOutbox(atacado, payload);
		expect(atacado.calls[0]).toEqual({
			method: "atualizarStatusNota",
			args: [30, input],
		});
	});

	test("registrarErro passa input", async () => {
		const atacado = fakeAtacado();
		const input = { cobrancaId: 1, erro: "TIMEOUT", mensagem: "x" };
		const payload: OutboxPayload = {
			method: "registrarErro",
			args: { input },
		};
		await despacharOutbox(atacado, payload);
		expect(atacado.calls[0]).toEqual({
			method: "registrarErro",
			args: [input],
		});
	});

	test("método desconhecido lança erro", async () => {
		const atacado = fakeAtacado();
		const payload = { method: "desconhecido", args: {} } as unknown as OutboxPayload;
		await expect(despacharOutbox(atacado, payload)).rejects.toThrow(/desconhecido/i);
	});
});

describe("outbox.worker — entregarLinha", () => {
	test("entrega com sucesso marca done", async () => {
		const atacado = fakeAtacado();
		await enqueueOutbox(db, {
			aggregate: "fatura",
			aggregateId: 1,
			payload: { method: "atualizarStatusFatura", args: { id: 1, status: "emitindo" } },
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
			payload: { method: "atualizarStatusFatura", args: { id: 1, status: "emitindo" } },
		});
		const [row] = await drainOutbox(db, 10);
		await expect(entregarLinha(db, atacado, row)).rejects.toThrow("Atacado fora");
		const rest = await drainOutbox(db, 10);
		expect(rest.length).toBe(1);
		expect(rest[0].attempts).toBe(1);
	});
});

describe("outbox.worker — drenarEEntregar", () => {
	test("drena múltiplas linhas de métodos distintos e entrega todas", async () => {
		const atacado = fakeAtacado();
		await enqueueOutbox(db, {
			aggregate: "fatura", aggregateId: 1,
			payload: { method: "atualizarStatusFatura", args: { id: 1, status: "emitida" } },
		});
		await enqueueOutbox(db, {
			aggregate: "cobranca", aggregateId: 2,
			payload: { method: "atualizarStatusCobranca", args: { id: 2, status: "emitida" } },
		});
		await enqueueOutbox(db, {
			aggregate: "nota", aggregateId: 3,
			payload: { method: "atualizarStatusNota", args: { id: 3, input: { statusInterno: "emitida" } } },
		});
		const entregues = await drenarEEntregar(db, atacado, 10);
		expect(entregues).toBe(3);
		const rest = await drainOutbox(db, 10);
		expect(rest).toEqual([]);
	});

	test("ordem: mais antiga primeiro (por id)", async () => {
		const atacado = fakeAtacado();
		await enqueueOutbox(db, { aggregate: "fatura", aggregateId: 1, payload: { method: "atualizarStatusFatura", args: { id: 1, status: "emitindo" } } });
		await enqueueOutbox(db, { aggregate: "fatura", aggregateId: 1, payload: { method: "atualizarStatusFatura", args: { id: 1, status: "emitida" } } });
		await drenarEEntregar(db, atacado, 10);
		expect(atacado.calls.map((c) => c.args[1])).toEqual(["emitindo", "emitida"]);
	});

	test("idempotência: entregar a mesma linha duas vezes chama atacado duas vezes (at-least-once) — Atacado é idempotente por id", async () => {
		const atacado = fakeAtacado();
		await enqueueOutbox(db, {
			aggregate: "fatura", aggregateId: 1,
			payload: { method: "atualizarStatusFatura", args: { id: 1, status: "emitida" } },
		});
		const [row] = await drainOutbox(db, 10);
		await entregarLinha(db, atacado, row);
		await entregarLinha(db, atacado, row); // replay (at-least-once)
		expect(atacado.calls.length).toBe(2);
	});
});
