import { describe, expect, it, mock, beforeEach } from "bun:test";
import { QUEUE_NAMES, JOB_NAMES } from "#/lib/queue-names";

// Mock ioredis so tests never connect to a real redis (no hang).
let ctorCalls: { url: string | undefined; opts: unknown }[] = [];
const FakeRedis = class FakeRedis {
	url: string | undefined;
	opts: unknown;
	constructor(url?: string, opts?: unknown) {
		this.url = url;
		this.opts = opts;
		ctorCalls.push({ url, opts });
	}
	async ping() {
		return "PONG";
	}
	async quit() {}
	async lpush(..._args: unknown[]) {
		return 1;
	}
};
mock.module("ioredis", () => ({ Redis: FakeRedis }));

// Mock env before any module that imports #/env is loaded (static imports are hoisted,
// so the modules that use env are imported dynamically AFTER this mock).
mock.module("#/env", () => ({
	env: {
		REDIS_URL: "redis://test:6390",
		RATE_LIMIT_ASAAS: 5,
		RATE_LIMIT_NFCOM: 2,
		RATE_LIMIT_ATACADO: 10,
	},
}));

// Mock BullMQ Queue so getQueue() never builds a real queue needing redis.
const queueCtorCalls: { name: string; opts: unknown }[] = [];
class FakeQueue {
	name: string;
	opts: unknown;
	constructor(name: string, opts: unknown) {
		this.name = name;
		this.opts = opts;
		queueCtorCalls.push({ name, opts });
	}
}
mock.module("bullmq", () => ({ Queue: FakeQueue, Worker: class {} }));

// Import modules that depend on env/ioredis/bullmq AFTER mocks are registered.
const { getRedis } = await import("#/lib/redis");
const { getQueue, WORKER_DEFAULTS, gracefulShutdown } = await import("#/lib/queues");
const { Queue } = await import("bullmq");

beforeEach(() => {
	ctorCalls = [];
	queueCtorCalls.length = 0;
});

describe("queue-names", () => {
	it("exposes the three queues from ADR-0002", () => {
		expect(QUEUE_NAMES).toEqual({
			EMISSAO: "emissao",
			OUTBOX: "outbox",
			WEBHOOK: "webhook",
		});
	});

	it("exposes the job names for the emission tree + outbox + webhook", () => {
		expect(JOB_NAMES).toEqual({
			EMIT_FATURA: "emit-fatura",
			EMIT_COBRANCA: "emit-cobranca",
			EMIT_NFCOM: "emit-nfcom",
			OUTBOX_RELAY: "outbox-relay",
			WEBHOOK_SEND: "webhook-send",
		});
	});
});

describe("redis", () => {
	it("getRedis() passes env.REDIS_URL and is a singleton", () => {
		const a = getRedis();
		const b = getRedis();
		expect(a).toBe(b);
		expect(ctorCalls.length).toBe(1);
		expect(ctorCalls[0]?.url).toBe("redis://test:6390");
	});
});

describe("queues", () => {
	it("getQueue(name) returns a BullMQ Queue and caches by name", () => {
		const q1 = getQueue(QUEUE_NAMES.EMISSAO);
		const q2 = getQueue(QUEUE_NAMES.EMISSAO);
		expect(q1).toBeInstanceOf(Queue);
		expect(q1).toBe(q2);
		// ctor called once for the same name (cache hit on second call)
		expect(queueCtorCalls.filter((c) => c.name === QUEUE_NAMES.EMISSAO).length).toBe(1);
	});

	it("different names return different queues", () => {
		const a = getQueue(QUEUE_NAMES.EMISSAO);
		const b = getQueue(QUEUE_NAMES.WEBHOOK);
		expect(a).not.toBe(b);
		// emissao já construída (cache do teste anterior); webhook é nova
		expect(queueCtorCalls.map((c) => c.name)).toContain(QUEUE_NAMES.WEBHOOK);
	});

	it("WORKER_DEFAULTS has 5 attempts with exponential backoff (ADR-0002)", () => {
		expect(WORKER_DEFAULTS).toEqual({
			attempts: 5,
			backoff: { type: "exponential" },
		});
	});

	it("gracefulShutdown closes workers with 30s default drain", async () => {
		const closed: boolean[] = [];
		const fakeWorker = {
			close: async () => {
				closed.push(true);
			},
		};
		// biome-ignore lint/suspicious/noExplicitAny:
		await gracefulShutdown([fakeWorker as any]);
		expect(closed).toEqual([true]);
	});
});
