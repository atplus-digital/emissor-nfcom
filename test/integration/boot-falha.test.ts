/**
 * Boot FALHO (migrate) de src/index.ts — cobre o caminho `main().catch` → process.exit(1).
 *
 * O smoke (boot.smoke.test.ts) cobre o caminho feliz (health 200 + SIGTERM → exit 0).
 * Este teste cobre o caminho de ERRO de boot: um `DATABASE_URL` que aponta para um
 * arquivo inválido (fora de um volume gravável) faz o `drizzle migrate` lançar → o
 * `main().catch` loga o erro fatal e chama `process.exit(1)`.
 *
 * É um arquivo de teste ISOLADO porque o boot falho tenta abrir um sqlite de failover
 * e levanta o logger/redis no processo — num arquivo compartilhado com outros boots
 * (smoke) os singletons/process listeners colidiriam.
 *
 * Requer Redis real? Não obrigatoriamente (a falha acontece ANTES de tocar o Redis,
 * no migrate), mas mantemos o mesmo guarda por consistência com os demais boots.
 */
import { describe, expect, test, afterEach } from "bun:test";

import { redisDisponivel } from "./helpers";

const REDIS_URL = "redis://localhost:6379";
const redisOk = await redisDisponivel(REDIS_URL);
if (!redisOk) {
	console.warn(
		"Redis não disponível em " + REDIS_URL + " — teste de boot falho pulado.",
	);
}

// Env REAL válida, exceto DATABASE_URL apontando para `/proc/meminfo` (arquivo
// fora de um volume gravável — o libsql não consegue abrir/migrar → main().catch).
process.env.PORT = String(39000 + Math.floor(Math.random() * 900));
process.env.DATABASE_URL = "/proc/meminfo";
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

describe("smoke — boot falho de src/index.ts", () => {
	test.skipIf(!redisOk)(
		"migrate falho → main().catch → process.exit(1)",
		{ timeout: 60_000 },
		async () => {
			const guarda = setTimeout(() => {
				throw new Error("boot-falha excedeu 60s (timeout duro)");
			}, 60_000);

			// Spy do process.exit ANTES do import (pega o exit(1) do main().catch).
			let exitCode: number | undefined;
			const exitSpy = ((code?: number) => {
				exitCode = code;
			}) as unknown as typeof process.exit;
			process.exit = exitSpy;

			try {
				// Boot real — main() roda no import e deve FALHAR no migrate.
				await import("#/index.ts");

				// O `main().catch` chama process.exit(1) de forma assíncrona.
				const fim = Date.now();
				while (exitCode === undefined && Date.now() - fim < 15_000) {
					await new Promise((r) => setTimeout(r, 100));
				}

				expect(exitCode, "main().catch deveria chamar process.exit(1)").toBe(1);
			} finally {
				clearTimeout(guarda);
				// Restaura o exit real SEMPRE.
				process.exit = exitOriginal;
			}
		},
	);
});

afterEach(() => {
	process.exit = exitOriginal;
});
