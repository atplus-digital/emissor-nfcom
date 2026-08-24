/**
 * Inspetor de filas — `src/lib/queue-inspector.ts`.
 *
 * - `montarSnapshotFilas`: contagens/estado/serialização de jobs (faturaId,
 *   paiId, falha, timestamps) com fakes de Queue (sem Redis).
 * - Limite por estado via `end` do `getJobs` (limite-1, asc).
 * - `getWorkers` indisponível → `workers: 0` (o snapshot segue).
 * - `inspecionarFilas`: liga as 3 filas canônicas via `getQueue` (mock.module
 *   do `#/lib/queues` — o pattern do `queues.test.ts`).
 */
import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { Job, JobType, Queue } from "bullmq";
import type { QueueName } from "#/lib/queue-names";

// Mock da fábrica de filas ANTES de importar o inspetor (evita Redis real).
const fakeQueues = new Map<QueueName, Queue>();
mock.module("#/lib/queues", () => ({
	getQueue: (nome: QueueName): Queue => {
		const q = fakeQueues.get(nome);
		if (!q) throw new Error(`getQueue fake: fila não registrada (${nome})`);
		return q;
	},
}));

const { montarSnapshotFilas, inspecionarFilas } = await import(
	"#/lib/queue-inspector"
);
const { QUEUE_NAMES } = await import("#/lib/queue-names");

interface FilaFake {
	queue: Queue;
	getJobsCalls: [JobType, number, number, boolean | undefined][];
}

function fakeQueue(
	opts: {
		contagens?: Record<string, number>;
		pausada?: boolean;
		workers?: unknown[] | "erro";
		jobs?: Partial<Record<JobType, Job[]>>;
	} = {},
): FilaFake {
	const getJobsCalls: FilaFake["getJobsCalls"] = [];
	const queue = {
		getJobCounts: async () =>
			opts.contagens ?? {
				waiting: 0,
				active: 0,
				delayed: 0,
				paused: 0,
				completed: 0,
				failed: 0,
			},
		isPaused: async () => opts.pausada ?? false,
		getWorkers: async () => {
			if (opts.workers === "erro") throw new Error("GETCLIENTS indisponível");
			return opts.workers ?? [];
		},
		getJobs: async (
			types: JobType | JobType[],
			start?: number,
			end?: number,
			asc?: boolean,
		) => {
			const t = (Array.isArray(types) ? types[0] : types) ?? "waiting";
			getJobsCalls.push([t, start ?? 0, end ?? 0, asc]);
			return opts.jobs?.[t] ?? [];
		},
	} as unknown as Queue;
	return { queue, getJobsCalls };
}

function fakeJob(over: Partial<Job> = {}): Job {
	return {
		id: "1",
		name: "emit-fatura",
		data: { faturaId: 101 },
		attemptsMade: 0,
		timestamp: 1_000,
		processedOn: undefined,
		finishedOn: undefined,
		failedReason: "",
		parent: undefined,
		...over,
	} as unknown as Job;
}

beforeEach(() => {
	fakeQueues.clear();
});

describe("montarSnapshotFilas", () => {
	it("monta contagens, pausada e nº de workers da fila", async () => {
		const { queue } = fakeQueue({
			contagens: {
				waiting: 2,
				active: 1,
				delayed: 0,
				paused: 0,
				completed: 3,
				failed: 1,
			},
			pausada: true,
			workers: [{ id: "1" }, { id: "2" }],
		});
		const snap = await montarSnapshotFilas([
			{ nome: QUEUE_NAMES.EMISSAO, queue },
		]);
		expect(snap.filas).toHaveLength(1);
		const fila = snap.filas[0]!;
		expect(fila.nome).toBe("emissao");
		expect(fila.contagens).toEqual({
			waiting: 2,
			active: 1,
			delayed: 0,
			paused: 0,
			completed: 3,
			failed: 1,
		});
		expect(fila.pausada).toBe(true);
		expect(fila.workers).toBe(2);
		expect(snap.geradoEm).toBeGreaterThan(0);
	});

	it("serializa jobs com estado, faturaId, paiId, falha e timestamps", async () => {
		const { queue } = fakeQueue({
			jobs: {
				waiting: [fakeJob({ id: "1", name: "emit-fatura" })],
				failed: [
					fakeJob({
						id: "2",
						name: "emit-cobranca",
						data: {},
						attemptsMade: 5,
						timestamp: 2_000,
						processedOn: 3_000,
						finishedOn: 4_000,
						failedReason: "boom: 5xx no Asaas",
						parent: { id: "1", queueKey: "bull:emissao" },
					}),
				],
			},
		});
		const snap = await montarSnapshotFilas([
			{ nome: QUEUE_NAMES.EMISSAO, queue },
		]);
		const jobs = snap.filas[0]!.jobs;
		expect(jobs).toEqual([
			{
				id: "1",
				nome: "emit-fatura",
				estado: "waiting",
				tentativas: 0,
				criadoEm: 1_000,
				processadoEm: null,
				finalizadoEm: null,
				falha: null,
				faturaId: 101,
				paiId: null,
			},
			{
				id: "2",
				nome: "emit-cobranca",
				estado: "failed",
				tentativas: 5,
				criadoEm: 2_000,
				processadoEm: 3_000,
				finalizadoEm: 4_000,
				falha: "boom: 5xx no Asaas",
				faturaId: null,
				paiId: "1",
			},
		]);
	});

	it("consulta até (limite-1) jobs por estado, em ordem asc", async () => {
		const { queue, getJobsCalls } = fakeQueue({ jobs: {} });
		await montarSnapshotFilas([{ nome: QUEUE_NAMES.EMISSAO, queue }], 5);
		expect(getJobsCalls).toHaveLength(5);
		expect(getJobsCalls.map((c) => c[0])).toEqual([
			"waiting",
			"active",
			"delayed",
			"failed",
			"completed",
		]);
		for (const [, start, end, asc] of getJobsCalls) {
			expect(start).toBe(0);
			expect(end).toBe(4);
			expect(asc).toBe(true);
		}
	});

	it("getWorkers indisponível → workers 0 e o snapshot segue", async () => {
		const { queue } = fakeQueue({ workers: "erro" });
		const snap = await montarSnapshotFilas([
			{ nome: QUEUE_NAMES.WEBHOOK, queue },
		]);
		expect(snap.filas[0]!.workers).toBe(0);
		expect(snap.filas[0]!.jobs).toEqual([]);
	});
});

describe("inspecionarFilas", () => {
	it("inspeciona as 3 filas canônicas (emissao → outbox → webhook)", async () => {
		fakeQueues.set(
			QUEUE_NAMES.EMISSAO,
			fakeQueue({ contagens: { waiting: 1 } }).queue,
		);
		fakeQueues.set(QUEUE_NAMES.OUTBOX, fakeQueue().queue);
		fakeQueues.set(QUEUE_NAMES.WEBHOOK, fakeQueue().queue);
		const snap = await inspecionarFilas();
		expect(snap.filas.map((f) => f.nome)).toEqual([
			"emissao",
			"outbox",
			"webhook",
		]);
		expect(snap.filas[0]!.contagens).toEqual({ waiting: 1 });
	});

	it("repassa o limite p/ o snapshot (end = limite-1)", async () => {
		const fake = fakeQueue({ jobs: {} });
		fakeQueues.set(QUEUE_NAMES.EMISSAO, fake.queue);
		fakeQueues.set(QUEUE_NAMES.OUTBOX, fakeQueue().queue);
		fakeQueues.set(QUEUE_NAMES.WEBHOOK, fakeQueue().queue);
		await inspecionarFilas(3);
		for (const [, , end] of fake.getJobsCalls) expect(end).toBe(2);
	});
});
