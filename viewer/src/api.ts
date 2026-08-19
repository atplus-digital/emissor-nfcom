import type {
	EmissaoView,
	FaturaDetalhe,
	FaturaResumo,
	FaturasFiltro,
	User,
} from "./types";

const BASE = "/painel";

/** Erro do envelope de erro do backend (ou de rede/HTTP). */
export class ApiError extends Error {
	readonly tipo: string;
	readonly status: number;
	readonly mensagem: string;

	constructor(status: number, tipo: string, mensagem: string) {
		super(mensagem);
		this.name = "ApiError";
		this.status = status;
		this.tipo = tipo;
		this.mensagem = mensagem;
	}

	get isUnauthorized(): boolean {
		return this.status === 401;
	}
}

interface EnvelopeErro {
	erro?: { tipo?: unknown; mensagem?: unknown };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	let res: Response;
	try {
		res = await fetch(`${BASE}${path}`, {
			...init,
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(init?.headers as Record<string, string> | undefined),
			},
		});
	} catch {
		throw new ApiError(0, "REDE", "Falha de rede ao falar com o backend");
	}

	if (!res.ok) {
		let corpo: unknown;
		try {
			corpo = (await res.json()) as unknown;
		} catch {
			corpo = null;
		}
		let tipo = "ERRO";
		let mensagem = `Erro HTTP ${res.status}`;
		if (corpo !== null && typeof corpo === "object") {
			const e = (corpo as EnvelopeErro).erro;
			if (e !== undefined) {
				if (typeof e.tipo === "string") tipo = e.tipo;
				if (typeof e.mensagem === "string") mensagem = e.mensagem;
			}
		}
		throw new ApiError(res.status, tipo, mensagem);
	}

	// Endpoints podem responder 204 vazio (logout).
	if (res.status === 204) return undefined as T;
	return (await res.json()) as T;
}

interface LoginResponse {
	ok: true;
	user: User;
}

export async function login(
	account: string,
	password: string,
): Promise<User> {
	const r = await request<LoginResponse>("/api/login", {
		method: "POST",
		body: JSON.stringify({ account, password }),
	});
	return r.user;
}

export async function logout(): Promise<void> {
	await request<{ ok: true }>("/api/logout", { method: "POST" });
}

export interface SessionResponse {
	user: User;
}

export async function getSession(): Promise<User> {
	const r = await request<SessionResponse>("/api/session");
	return r.user;
}

export async function listFaturas(filtro: FaturasFiltro = {}): Promise<FaturaResumo[]> {
	const params = new URLSearchParams();
	if (filtro.parceiroId) params.set("parceiroId", filtro.parceiroId);
	if (filtro.dataReferencia) params.set("dataReferencia", filtro.dataReferencia);
	if (filtro.status) params.set("status", filtro.status);
	const qs = params.toString();
	return request<FaturaResumo[]>(
		`/api/faturas${qs ? `?${qs}` : ""}`,
	);
}

export async function getFatura(id: number | string): Promise<FaturaDetalhe> {
	return request<FaturaDetalhe>(`/api/faturas/${encodeURIComponent(String(id))}`);
}

export async function getEmissao(id: number | string): Promise<EmissaoView> {
	return request<EmissaoView>(
		`/api/faturas/${encodeURIComponent(String(id))}/emissao`,
	);
}
