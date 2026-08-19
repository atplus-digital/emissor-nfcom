import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/**
 * Env validada por Zod (ADR-0005) — nunca `process.env` direto.
 */
const _env = createEnv({
	server: {
		// App
		PORT: z.coerce.number().int().positive().default(3000),
		DATABASE_URL: z.string().default("./data/emissor.db"),

		EMISSOR_API_KEY: z.string().min(1),

		// Redis / BullMQ (ADR-0002)
		REDIS_URL: z.url(),
		
		// Atacado (ADR-0004)
		NOCOBASE_API_KEY: z.string().min(1),
		NOCOBASE_API_URL: z.url(),
		NOCOBASE_APP: z.string().optional(),
		/** Id do autenticador NocoBase (header `X-Authenticator` da auth:signIn/check). */
		NOCOBASE_AUTHENTICATOR: z.string().default("password"),

		// Painel de visualização (login NocoBase + cookie assinado)
		/**
		 * Secret do cookie de sessão do painel (`painel_sess`, HMAC-SHA256).
		 * **Opcional de propósito**: ausente = painel desligado (o server não
		 * monta as rotas /painel) — não quebra o deploy existente.
		 */
		PAINEL_COOKIE_SECRET: z.string().optional(),

		// Asaas (ADR-0004)
		ASAAS_API_KEY: z.string().min(1),
		ASAAS_API_URL: z.url(),
		
		// NFCom gateway (ADR-0001)
		NFCOM_API_URL: z.url(),
		NFCOM_LOGIN: z.string().min(1),
		NFCOM_SENHA: z.string().min(1),

		// Webhook de saída (SPEC-0001 passo 6; vazio = não empurra, caso 14)
		WEBHOOK_URL: z.union([z.literal(""), z.url()]).default(""),
		WEBHOOK_SECRET: z.string().default(""),
		
		// Rate-limit por gateway em req/s (ADR-0002)
		RATE_LIMIT_ASAAS: z.coerce.number().positive().default(5),
		RATE_LIMIT_NFCOM: z.coerce.number().positive().default(2),
		RATE_LIMIT_ATACADO: z.coerce.number().positive().default(10),
		
		// Defaults fiscais (SPEC-0002; revisar com contador)
		FISCAL_CFOP_DEFAULT: z.string().default("6307"),
		FISCAL_CCLASS_DEFAULT: z.string().min(1),
		FISCAL_ICMS_ALIQUOTA: z.coerce.number().min(0).max(1).default(0),
		// Opcional: placeholder p/ o caso de o gateway exigir um valor numérico
		// p/ destinatário isento (parceiro com f_ie="ISENTO" — Defeito B). Sem a
		// env, o campo `rgie` vai omitido no payload; com ela, o valor é enviado
		// como IE do destinatário. Confirmar com contador/provedor (o boot NÃO
		// depende dela — `emptyStringAsUndefined` já trata vazio como ausente).
		FISCAL_IE_ISENTO: z.string().optional(),

		// Logging (ADR-0008): nível default `info`, habilitável por env.
		LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
	},

	/**
	 * Ferramentas (generate:types, scripts) compartilham este .env mas usam
	 * subconjuntos próprios — validam as suas vars separadamente.
	 */
	emptyStringAsUndefined: true,
	runtimeEnv: process.env,
});

/**
 * Webhook (SPEC-0001): `WEBHOOK_URL` vazia desativa o push (caso 14). Quando ativa
 * (`WEBHOOK_URL` setada), o `WEBHOOK_SECRET` é **obrigatório** — ele forma o HMAC
 * do header `X-Webhook-Signature` (CONVENTIONS.md · Autorização) que o cliente usa
 * para verificar a origem. Em dev, deixar `WEBHOOK_URL` vazia em vez de setar URL
 * sem segredo.
 */
if (_env.WEBHOOK_URL && !_env.WEBHOOK_SECRET) {
	throw new Error(
		"WEBHOOK_SECRET é obrigatório quando WEBHOOK_URL está configurada " +
			"(assina o webhook via HMAC — CONVENTIONS.md · Autorização).",
	);
}

export const env = _env;

