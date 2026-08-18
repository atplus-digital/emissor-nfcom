/**
 * Rate-limit por gateway (ADR-0002).
 *
 * O BullMQ rate-limiter é **por fila** — e a árvore de emissão (fatura → cobrança
 * → nfcom) vive numa ÚNICA fila `emissao`, porque BullMQ Flows exige parent/child
 * na MESMA fila. Não dá para rate-limit by gateway via fila: separar as filas
 * quebraria o Flow, e um único limite de fila estrangulava o Asaas (mais alto) ao
 * teto do NFCom (mais baixo).
 *
 * Solução: rate-limit **na chamada externa** (nível de provedor), não na fila.
 * Cada chamada a um provedor é serializada por um `RateLimiter` próprio (sliding
 * window de 1s, max = env `RATE_LIMIT_*`), aplicado no composition root via
 * `wrapWithRateLimit` sobre a porta. Assim Asaas e NFCom respeitam **cada um a sua
 * env**, independente da fila — o ADR honrado na granularidade que importa.
 */
export interface RateLimiter {
	/** Tenta adquirir um slot agora. `null` se no teto do janela. */
	tryAcquire(): (() => void) | null;
	/** Aguarda (poll) até haver slot e adquire. Devolve a função de release. */
	acquire(): Promise<() => void>;
}

/**
 * Sliding-window de 1 segundo. Mantém os carimbos de tempo das chamadas no janela;
 * `tryAcquire` aceita se houver espaço, senão devolve `null`. `acquire` faz poll
 * com `sleepMs` até conseguir (útil no caminho real; testes usam `tryAcquire` p/
 * assertar o teto sem bloquear).
 */
export function createRateLimiter(maxPerSec: number): RateLimiter {
	const windowMs = 1000;
	const sleepMs = 25;
	const calls: number[] = [];

	function prune(now: number): void {
		const cutoff = now - windowMs;
		for (let i = calls.length - 1; i >= 0; i--) {
			if (calls[i]! < cutoff) calls.splice(i, 1);
		}
	}

	return {
		tryAcquire() {
			const now = Date.now();
			prune(now);
			if (calls.length >= maxPerSec) return null;
			calls.push(now);
			return () => {
				const i = calls.indexOf(now);
				if (i >= 0) calls.splice(i, 1);
			};
		},
		async acquire() {
			for (;;) {
				const release = this.tryAcquire();
				if (release) return release;
				await new Promise((r) => setTimeout(r, sleepMs));
			}
		},
	};
}

/**
 * Envolve uma porta/objeto com um `RateLimiter`: cada método (função) do alvo é
 * serializado por `limiter.acquire()`/release, limitando as chamadas externas ao
 * teto do provedor. Métodos não-função passam intactos. Usado no composition root
 * para aplicar o rate-limit por gateway sobre `AsaasPort`/`NfcomPort`.
 */
export function wrapWithRateLimit<T extends object>(target: T, limiter: RateLimiter): T {
	const proxy = new Proxy(target, {
		get(t, prop) {
			const value = (t as Record<PropertyKey, unknown>)[prop];
			if (typeof value !== "function") return value;
			return async (...args: unknown[]) => {
				const release = await limiter.acquire();
				try {
					return await value.apply(t, args);
				} finally {
					release();
				}
			};
		},
	});
	return proxy;
}
