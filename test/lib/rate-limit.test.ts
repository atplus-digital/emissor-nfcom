import { describe, expect, it } from "bun:test";
import { createRateLimiter, wrapWithRateLimit } from "#/lib/rate-limit";

describe("createRateLimiter (ADR-0002)", () => {
	it("permite até max chamadas no janela e bloqueia além (sliding window 1s)", () => {
		const limiter = createRateLimiter(2);
		const r1 = limiter.tryAcquire();
		const r2 = limiter.tryAcquire();
		// as duas primeiras passam
		expect(r1).toBeTruthy();
		expect(r2).toBeTruthy();
		// terceira no mesmo janela: bloqueada
		expect(limiter.tryAcquire()).toBeNull();
		// libera um slot → nova chamada passa
		r2?.();
		expect(limiter.tryAcquire()).toBeTruthy();
	});

	it("acumula após o janela expirar", async () => {
		const limiter = createRateLimiter(1);
		expect(limiter.tryAcquire()).toBeTruthy();
		expect(limiter.tryAcquire()).toBeNull();
		// janela de 1s expira → libera
		await new Promise((r) => setTimeout(r, 1050));
		expect(limiter.tryAcquire()).toBeTruthy();
	});

	it("acquire() faz poll até haver slot (2ª chamada aguarda a janela)", async () => {
		const limiter = createRateLimiter(1);
		const release1 = await limiter.acquire();
		// 1ª chamada consumiu o slot da janela de 1s — a 2ª precisa aguardar.
		const t0 = Date.now();
		const release2 = await limiter.acquire();
		expect(Date.now() - t0).toBeGreaterThanOrEqual(25); // poll (sleepMs = 25)
		// release devolve o slot ao contador (tryAcquire volta a passar)
		release1();
		release2();
		expect(limiter.tryAcquire()).toBeTruthy();
	});
});

describe("wrapWithRateLimit (ADR-0002)", () => {
	it("serializa cada método da porta pelo limiter", async () => {
		let calls = 0;
		const target = {
			async foo() {
				calls++;
				return "ok";
			},
		};
		// limiter de 1/s: segunda chamada imediata aguarda o release da primeira
		const limiter = createRateLimiter(1);
		const proxied = wrapWithRateLimit(target, limiter);
		const r1 = await (proxied.foo as () => Promise<string>)();
		const p2 = (proxied.foo as () => Promise<string>)();
		// r1 já retornou e liberou; p2 pode rodar (mas roda após o release)
		expect(r1).toBe("ok");
		const r2 = await p2;
		expect(r2).toBe("ok");
		expect(calls).toBe(2);
	});

	it("passa propriedades não-função intactas", () => {
		const target = { valor: 42, async bar() {} };
		const proxied = wrapWithRateLimit(target, createRateLimiter(5));
		expect((proxied as unknown as { valor: number }).valor).toBe(42);
	});
});
