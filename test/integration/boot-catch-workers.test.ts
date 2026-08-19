/**
 * Cobre o catch `() => []` do shutdown de src/index.ts (linha 141): quando
 * `emissaoWorkers.workers` REJEITA, o `Promise.resolve(...).catch(() => [])`
 * executa o no-op. Mockamos `#/workers/emissao.worker` para que `criarEmissaoWorker`
 * devolva um `workers` rejeitado — o resto do boot é real (Redis + DB + app).
 */
import { describe, expect, test, afterEach, mock } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { redisDisponivel } from "./helpers";

mock.module("#/workers/emissao.worker", () => ({
	// `workers` rejeita de forma ASSÍNCRONA (async IIFE), como o real. Anexamos
	// um no-op `.catch` imediatamente para o runner não tratar a rejeição como
	// unhandled ANTES do shutdown; o `Promise.resolve(...).catch(() => [])` do
	// shutdown (index.ts 141) adiciona um SEGUNDO handler que executa o no-op.
	criarEmissaoWorker: () => {
		const workers = (async () => {
			throw new Error("worker wiring falhou");
		})();
		workers.catch(() => {}); // evita unhandled rejection precoce
		return { workers };
	},
}));

const REDIS_URL = "redis://localhost:6379";
const redisOk = await redisDisponivel(REDIS_URL);

const PORT = 41000 + Math.floor(Math.random() * 900);
const DATABASE_URL = join(tmpdir(), `emissor-bootcatch-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);

process.env.PORT = String(PORT);
process.env.DATABASE_URL = DATABASE_URL;
process.env.EMISSOR_API_KEY = "smoke-key";
process.env.REDIS_URL = REDIS_URL;
process.env.NOCOBASE_API_KEY = "smoke";
process.env.NOCOBASE_API_URL = "https://example.com/api";
process.env.ASAAS_API_KEY = "smoke";
process.env.ASAAS_API_URL = "https://example.com";
process.env.NFCOM_API_URL = "https://example.com";
process.env.NFCOM_LOGIN = "smoke";
process.env.NFCOM_SENHA = "smoke";
process.env.WEBHOOK_URL = "";
process.env.WEBHOOK_SECRET = "";
process.env.RATE_LIMIT_ASAAS = "5";
process.env.RATE_LIMIT_NFCOM = "2";
process.env.RATE_LIMIT_ATACADO = "10";
process.env.FISCAL_CFOP_DEFAULT = "6307";
process.env.FISCAL_CCLASS_DEFAULT = "0100201";
process.env.FISCAL_ICMS_ALIQUOTA = "0";
process.env.LOG_LEVEL = "silent";

const exitOriginal = process.exit.bind(process) as unknown as typeof process.exit;

describe("smoke — boot com workers rejeitando (catch () => [] do shutdown)", () => {
	test.skipIf(!redisOk)(
		"shutdown com emissaoWorkers.workers rejeitado → catch no-op e exit 0",
		{ timeout: 60_000 },
		async () => {
			let exitCode: number | undefined;
			const exitSpy = ((code?: number) => { exitCode = code; }) as unknown as typeof process.exit;
			process.exit = exitSpy;

			try {
				await import("#/index.ts");

				// Aguarda o server /health subir.
				let ok = false;
				const inicio = Date.now();
				while (Date.now() - inicio < 15_000) {
					try {
						const res = await fetch(`http://localhost:${PORT}/health`);
						if (res.status === 200) { ok = true; break; }
					} catch {}
					await new Promise((r) => setTimeout(r, 250));
				}
				expect(ok).toBe(true);

				// SIGTERM → shutdown → workers rejeitado → catch () => [] → exit 0.
				process.emit("SIGTERM");
				const fim = Date.now();
				while (exitCode === undefined && Date.now() - fim < 15_000) {
					await new Promise((r) => setTimeout(r, 100));
				}
				expect(exitCode).toBe(0);
			} finally {
				process.exit = exitOriginal;
			}
		},
	);
});

afterEach(() => { process.exit = exitOriginal; });
