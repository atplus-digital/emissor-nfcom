/**
 * Cenário feliz: env completa e válida — o import de `#/env` resolve e os
 * defaults/coerções do Zod se aplicam (ADR-0005).
 *
 * Como `env.ts` é singleton por processo, este arquivo monta UM único cenário
 * de validation ANTES do primeiro import; o import de `#/env` só acontece uma
 * vez aqui (dentro de `beforeAll`) e o resultado é reutilizado nos testes.
 */
import { describe, expect, test, beforeAll } from "bun:test";
import { clearEnv, setEnv } from "./helpers";

// Base completa e válida — espelha o .env.example.
// FISCAL_CFOP_DEFAULT, FISCAL_CCLASS_DEFAULT e RATE_LIMIT_ATACADO ficam de fora
// de propósito para exercitarmos os defaults.
clearEnv();
setEnv({
	PORT: "4649",
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
	FISCAL_CCLASS_DEFAULT: "0100201",
	FISCAL_ICMS_ALIQUOTA: "0",
});

// Import único e compartilhado, após a env estar pronta.
const { env } = await import("#/env");

describe("env válida (ADR-0005)", () => {
	test("import resolve e expõe as variáveis completas", () => {
		expect(env).toBeDefined();
		expect(env.EMISSOR_API_KEY).toBe("segredo-da-api");
		expect(env.NFCOM_LOGIN).toBe("login-nfcom");
	});

	test("coerciona strings numéricas para number", () => {
		expect(env.PORT).toBe(4649);
		expect(env.RATE_LIMIT_NFCOM).toBe(2);
		expect(env.RATE_LIMIT_ASAAS).toBe(5);
		expect(env.FISCAL_ICMS_ALIQUOTA).toBe(0);
	});

		test("aplica defaults quando a var é omitida", () => {
			// Omitido: cai no default "6307"
			expect(env.FISCAL_CFOP_DEFAULT).toBe("6307");
			// Omitido: cai no default 10
			expect(env.RATE_LIMIT_ATACADO).toBe(10);
		// Omitido: cai no default 3000
		expect(env.PORT).toBe(4649);
		// Omitido: cai no default ""
		expect(env.WEBHOOK_URL).toBe("");
		// Omitido → default "info"
		expect(env.LOG_LEVEL).toBe("info");
	});
});
