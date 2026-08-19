/**
 * Smoke do boot real de src/index.ts (composition root).
 *
 * Sobe o app inteiro com env REAL (process.env) — sem mock.module("#/env") — até o
 * server HTTP responder /health 200, e então dispara SIGTERM para validar o graceful
 * shutdown (`shutdown concluído` → process.exit(0)).
 *
 * Requer Redis real. Skip gracioso sem ele.
 *
 * IMPORTANTE: o spy em `process.exit` é instalado ANTES do `import` dinâmico do index,
 * pois main().catch chama process.exit(1) em erro de boot — se o spy não estivesse lá,
 * um boot quebrado mataria o worker do teste.
 */
import { describe, expect, test, afterEach } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { redisDisponivel } from "./helpers";

const REDIS_URL = "redis://localhost:6379";
const redisOk = await redisDisponivel(REDIS_URL);
if (!redisOk) {
	console.warn(
		"Redis não disponível em " + REDIS_URL + " — smoke de boot pulado; rode com redis:7.",
	);
}

/** Porta alta aleatória para não conflitar com outros processos. */
const PORT = 39000 + Math.floor(Math.random() * 900);
const DATABASE_URL = join(tmpdir(), `emissor-boot-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);

// Env REAL (não mock.module) — o index valida e usa via #/env lendo process.env.
process.env.PORT = String(PORT);
process.env.DATABASE_URL = DATABASE_URL;
process.env.EMISSOR_API_KEY = "smoke-key";
process.env.REDIS_URL = REDIS_URL;
process.env.NOCOBASE_API_KEY = "smoke";
process.env.NOCOBASE_API_URL = "https://example.com/api";
process.env.NOCOBASE_APP = "a_atacado";
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

// Guarda o exit original p/ restaurar no finally (um process.exit real mataria o runner).
const exitOriginal = process.exit.bind(process) as unknown as typeof process.exit;

describe("smoke — boot real de src/index.ts", () => {
	test.skipIf(!redisOk)(
		"sobe o app, /health responde 200 e SIGTERM encerra com exit 0",
		async () => {
			// Timeout duro de 60s — um hang falha o teste em vez de travar o CI.
			const guarda = setTimeout(() => {
				throw new Error("boot smoke excedeu 60s (timeout duro)");
			}, 60_000);

			// Spy do process.exit ANTES do import do index (pega exit(1) de boot tb).
			let exitCode: number | undefined;
			const exitSpy = ((code?: number) => {
				exitCode = code;
			}) as unknown as typeof process.exit;
			process.exit = exitSpy;

			try {
				// Boot real — main() roda no import.
				await import("#/index.ts");

				// Polia /health até 200 (15s, 250ms de intervalo).
				let ok = false;
				const inicio = Date.now();
				let lastStatus = -1;
				while (Date.now() - inicio < 15_000) {
					try {
						const res = await fetch(`http://localhost:${PORT}/health`);
						lastStatus = res.status;
						if (res.status === 200) {
							ok = true;
							break;
						}
					} catch {
						// server ainda subindo — tenta de novo
					}
					await new Promise((r) => setTimeout(r, 250));
				}
				expect(ok, `health deveria responder 200 (último status=${lastStatus})`).toBe(true);

				// Dispara SIGTERM → handler de shutdown → process.exit(0) (agora é o spy).
				process.emit("SIGTERM");

				// Aguarda o shutdown concluir (exit spy chamado com 0).
				const fim = Date.now();
				while (exitCode === undefined && Date.now() - fim < 15_000) {
					await new Promise((r) => setTimeout(r, 100));
				}

				expect(exitCode, "shutdown deveria chamar process.exit(0)").toBe(0);
			} finally {
				clearTimeout(guarda);
				// Restaura o exit real SEMPRE (um exit real mataria o worker do teste).
				process.exit = exitOriginal;
			}
		},
	);
});

afterEach(() => {
	process.exit = exitOriginal;
});
