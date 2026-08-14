import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/**
 * Env validada por Zod (ADR-0005) — nunca `process.env` direto.
 */
export const env = createEnv({
	server: {
		// App
		PORT: z.coerce.number().int().positive().default(3000),
		EMISSOR_API_KEY: z.string().min(1),
		DATABASE_URL: z.string().default("./data/emissor.db"),
		// Redis / BullMQ (ADR-0002)
		REDIS_URL: z.string().url(),
		// Atacado (ADR-0004)
		NOCOBASE_API_KEY: z.string().min(1),
		NOCOBASE_API_URL: z.string().url(),
		NOCOBASE_APP: z.string().optional(),
		// Asaas (ADR-0004)
		ASAAS_API_KEY: z.string().min(1),
		ASAAS_API_URL: z.string().url(),
		// NFCom gateway (ADR-0001)
		NFCOM_API_URL: z.string().url(),
		NFCOM_LOGIN: z.string().min(1),
		NFCOM_SENHA: z.string().min(1),
		// Webhook de saída (SPEC-0001 passo 6; vazio = não empurra, caso 14)
		WEBHOOK_URL: z.string().url().default(""),
		WEBHOOK_SECRET: z.string().default(""),
		// Rate-limit por gateway em req/s (ADR-0002)
		RATE_LIMIT_ASAAS: z.coerce.number().positive().default(5),
		RATE_LIMIT_NFCOM: z.coerce.number().positive().default(2),
		RATE_LIMIT_ATACADO: z.coerce.number().positive().default(10),
		// Defaults fiscais (SPEC-0002; revisar com contador)
		FISCAL_CFOP_DEFAULT: z.string().default("6102"),
		FISCAL_CCLASS_DEFAULT: z.string().default(""),
		FISCAL_ICMS_ALIQUOTA: z.coerce.number().min(0).max(1).default(0),
	},

	/**
	 * Ferramentas (generate:types, scripts) compartilham este .env mas usam
	 * subconjuntos próprios — validam as suas vars separadamente.
	 */
	emptyStringAsUndefined: true,
	runtimeEnv: process.env,
});
