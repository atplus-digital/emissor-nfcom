/**
 * Cenário inválido #3 (regra do webhook, SPEC-0001): `WEBHOOK_URL` configurada
 * sem `WEBHOOK_SECRET` → a checagem no fim de `env.ts` lança erro próprio
 * (message contém "WEBHOOK_SECRET").
 *
 * Variante por remoção: deixar `WEBHOOK_SECRET` de fora da env (equivalente a
 * `""` por causa de emptyStringAsUndefined) — o HMAC não tem chave.
 */
import { describe, expect, test } from "bun:test";
import { clearEnv, setEnv } from "./helpers";

// Base válida, MAS com WEBHOOK_URL ativa e SEM WEBHOOK_SECRET.
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
	WEBHOOK_SECRET: "", // vazio ⇒ undefined ⇒ regra falha
	RATE_LIMIT_ASAAS: "5",
	RATE_LIMIT_NFCOM: "2",
	RATE_LIMIT_ATACADO: "10",
	FISCAL_CCLASS_DEFAULT: "0100201",
	FISCAL_ICMS_ALIQUOTA: "0",
});

describe("env inválida — WEBHOOK_URL sem WEBHOOK_SECRET (SPEC-0001)", () => {
	test("import de #/env rejeita mencionando WEBHOOK_SECRET", async () => {
		await expect(import("#/env")).rejects.toThrow(/WEBHOOK_SECRET/);
	});
});
