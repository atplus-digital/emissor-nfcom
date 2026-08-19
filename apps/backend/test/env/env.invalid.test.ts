/**
 * Cenário inválido #1: env completa EXCETO `EMISSOR_API_KEY` (obrigatória,
 * z.string().min(1)). `createEnv` lança → o import de `#/env` rejeita.
 *
 * Como a rejeição "envenena" o módulo no processo, cada cenário inválido vive em
 * seu próprio arquivo (isolamento por processo do `bun test --isolate`).
 */
import { describe, expect, test } from "bun:test";
import { clearEnv, setEnv } from "./helpers";

// Base válida — mas SEM `EMISSOR_API_KEY` (string vazia cai em
// emptyStringAsUndefined e, sem default, quebra a validação).
clearEnv();
setEnv({
	PORT: "3000",
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
	FISCAL_ICMS_ALIQUOTA: "0",
});

describe("env inválida — EMISSOR_API_KEY ausente (ADR-0005)", () => {
	test("import de #/env rejeita", async () => {
		await expect(import("#/env")).rejects.toThrow();
	});
});
