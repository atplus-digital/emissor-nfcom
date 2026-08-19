/**
 * Cenário inválido #2: `FISCAL_ICMS_ALIQUOTA` fora do domínio válido
 * (z.coerce.number().min(0).max(1)). Valor "5" → rejeita no import.
 *
 * Arquivo próprio porque o import rejeitado "envenena" o módulo `#/env` no
 * processo (isolamento por arquivo do `bun test --isolate`).
 */
import { describe, expect, test } from "bun:test";
import { clearEnv, setEnv } from "./helpers";

// Base válida, mas com alíquota ICMS fora de [0,1].
clearEnv();
setEnv({
	PORT: "3000",
	EMISSOR_API_KEY: "segredo-da-api",
	DATABASE_URL: "./data/emissor.db",
	REDIS_URL: "redis://localhost:6379",
	NOCOBASE_API_KEY: "client-atacado",
	NOCOBASE_API_URL: "https://atacado.atplus.com.br/api",
	ASAAS_API_KEY: "asaas-sandbox",
	ASAAS_API_URL: "https://api-sandbox.asaas.com",
	NFCOM_API_URL: "https://api.nfcom.com.br",
	NFCOM_LOGIN: "login-nfcom",
	NFCOM_SENHA: "senha-nfcom",
	WEBHOOK_URL: "",
	WEBHOOK_SECRET: "",
	RATE_LIMIT_ASAAS: "5",
	RATE_LIMIT_NFCOM: "2",
	RATE_LIMIT_ATACADO: "10",
	FISCAL_CCLASS_DEFAULT: "0100201",
	FISCAL_ICMS_ALIQUOTA: "5", // > 1 → inválido
});

describe("env inválida — FISCAL_ICMS_ALIQUOTA fora de [0,1] (ADR-0005)", () => {
	test("import de #/env rejeita", async () => {
		await expect(import("#/env")).rejects.toThrow();
	});
});
