/**
 * Cliente HTTP do Asaas API v3 (ADR-0004).
 *
 * Contrato externo real: header `access_token`, resposta com `errors[]`,
 * `billingType: BOLETO`. O cliente é injetável (`fetchImpl`) p/ testes sem
 * rede. Tipos externos do Asaas vivem só aqui e no translator — não cruzam
 * a fronteira do módulo (ADR-0004).
 */
import { log } from "#/lib/logger";

/** Cache do env lido de forma preguiçosa — só dispara validação quando o caller
 * não injeta baseUrl/apiKey (testes injetam, evitando o custo de env real). */
let _envCache: { baseUrl: string; apiKey: string } | null = null;
async function envOrThrow(): Promise<{ baseUrl: string; apiKey: string }> {
	if (_envCache) return _envCache;
	const { env } = await import("#/env");
	_envCache = { baseUrl: env.ASAAS_API_URL, apiKey: env.ASAAS_API_KEY };
	return _envCache;
}

/** Erro tipado do Asaas — carrega o payload `errors[]` (ADR-0004). */
export class AsaasApiError extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly errors: ReadonlyArray<{ code: string; description: string }>,
	) {
		super(message);
		this.name = "AsaasApiError";
	}
}

/** Shape externo do customer no Asaas. */
export interface AsaasCustomerDTO {
	id: string;
	name: string;
	email: string;
	cpfCnpj: string;
}

/** Shape externo do payment (boleto) no Asaas. */
export interface AsaasPaymentDTO {
	id: string;
	invoiceUrl: string;
}

export interface AsaasListDTO<T> {
	data: T[];
	totalCount: number;
}

export interface CriarPaymentBody {
	customer: string;
	billingType: "BOLETO";
	value: number;
	dueDate: string;
	externalReference: string;
}

export interface AsaasClient {
	buscarCustomerPorDocumento(cpfcnpj: string): Promise<AsaasListDTO<AsaasCustomerDTO>>;
	criarCustomer(body: {
		name: string;
		email: string;
		cpfCnpj: string;
	}): Promise<AsaasCustomerDTO>;
	atualizarCustomer(id: string, body: { name?: string; email?: string }): Promise<AsaasCustomerDTO>;
	criarPayment(body: CriarPaymentBody): Promise<AsaasPaymentDTO>;
	consultarPaymentPorExternalReference(
		externalReference: string,
	): Promise<AsaasListDTO<AsaasPaymentDTO>>;
}

export interface CreateAsaasClientOpts {
	fetchImpl?: typeof fetch;
	baseUrl?: string;
	apiKey?: string;
}

/**
 * Factory do cliente Asaas. Em produção lê `env.ASAAS_API_URL` /
 * `env.ASAAS_API_KEY`; em teste, injeta via `opts`.
 */
export function createAsaasClient(opts: CreateAsaasClientOpts = {}): AsaasClient {
	const fetchImpl = opts.fetchImpl ?? fetch;
	// Resolve baseUrl/apiKey: opts injetados (testes) prevalecem; senão lê env lazy.
	const resolveCreds = async () => {
		if (opts.baseUrl && opts.apiKey) return { baseUrl: opts.baseUrl, apiKey: opts.apiKey };
		const e = await envOrThrow();
		return { baseUrl: opts.baseUrl ?? e.baseUrl, apiKey: opts.apiKey ?? e.apiKey };
	};

	async function request<T>(path: string, init: RequestInit): Promise<T> {
		const { baseUrl, apiKey } = await resolveCreds();
		const url = `${baseUrl}${path}`;
		const res = await fetchImpl(url, {
			...init,
			headers: {
				"Content-Type": "application/json",
				access_token: apiKey,
				...(init.headers ?? {}),
			},
		});
		const body = (await res.json()) as unknown;
		if (!res.ok) {
			const errors = (body as { errors?: { code: string; description: string }[] }).errors ?? [];
			log.warn({ status: res.status, path }, "asaas: resposta não-2xx");
			throw new AsaasApiError(
				`Asaas ${res.status} em ${path}`,
				res.status,
				errors,
			);
		}
		return body as T;
	}

	return {
		buscarCustomerPorDocumento(cpfcnpj) {
			return request<AsaasListDTO<AsaasCustomerDTO>>(
				`/v3/customers?cpfCnpj=${encodeURIComponent(cpfcnpj)}`,
				{ method: "GET" },
			);
		},
		criarCustomer(body) {
			return request<AsaasCustomerDTO>(`/v3/customers`, {
				method: "POST",
				body: JSON.stringify(body),
			});
		},
		atualizarCustomer(id, body) {
			return request<AsaasCustomerDTO>(`/v3/customers/${encodeURIComponent(id)}`, {
				method: "PUT",
				body: JSON.stringify(body),
			});
		},
		criarPayment(body) {
			return request<AsaasPaymentDTO>(`/v3/payments`, {
				method: "POST",
				body: JSON.stringify(body),
			});
		},
		consultarPaymentPorExternalReference(externalReference) {
			return request<AsaasListDTO<AsaasPaymentDTO>>(
				`/v3/payments?externalReference=${encodeURIComponent(externalReference)}`,
				{ method: "GET" },
			);
		},
	};
}
