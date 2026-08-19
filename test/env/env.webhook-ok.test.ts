/**
 * Cenário feliz do webhook (SPEC-0001): `WEBHOOK_URL` ativa COM
 * `WEBHOOK_SECRET` presente → a regra do fim de `env.ts` não dispara e o import
 * resolve. Arquivo próprio pois precisa de env diferente do cenário "sem
 * segredo" (que fica em env.webhook-rule.test.ts).
 */
import { describe, expect, test } from "bun:test";
import { clearEnv, setEnv } from "./helpers";

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
	WEBHOOK_URL: "https://hook.example/x",
	WEBHOOK_SECRET: "hmac-segredo",
	RATE_LIMIT_ASAAS: "5",
	RATE_LIMIT_NFCOM: "2",
	RATE_LIMIT_ATACADO: "10",
	FISCAL_CCLASS_DEFAULT: "0100201",
	FISCAL_ICMS_ALIQUOTA: "0",
});

const { env } = await import("#/env");

describe("env OK — WEBHOOK_URL com WEBHOOK_SECRET (SPEC-0001)", () => {
	test("import resolve e expõe a URL do webhook", () => {
		expect(env.WEBHOOK_URL).toBe("https://hook.example/x");
		expect(env.WEBHOOK_SECRET).toBe("hmac-segredo");
	});
});
