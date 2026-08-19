/**
 * Repository NFCom — implementa `NfcomPort` (ADR-0001/0004).
 *
 * Token cache com TTL 12h (env/inalterável em teste via `ttlMs`/`now`
 * injetáveis). `emitirNFCom` usa o token em cache; em 401 → invalida cache,
 * reautentica e **retry uma vez** (SPEC-0001 caso 9). Erro não-401 propaga
 * (não retry — o worker/classificação decide o que é RETRYABLE/FATAL).
 */
import type {
	EmitirNFComInput,
	EmitirNFComResultado,
	NfcomPort,
	NFComListaItem,
} from "#/domain/ports/nfcom.port";
import { log } from "#/lib/logger";
import type { NfcomClient, NfcomApiError } from "./nfcom.client";
import { montarPayloadEmitir, traduzirResultadoEmitir } from "./translators/emitir";
import { normalizarSituacaoLeniente } from "./translators/situacao";

/** TTL de 12h em ms (cache do token do gateway — ADR-0001). */
const TTL_12H_MS = 12 * 60 * 60 * 1000;

/**
 * Credenciais do gateway. Injetáveis (o composition root liga `env.NFCOM_*`);
 * o repository não importa `env` diretamente para não disparar a validação
 * de env em testes que só exercitam o contrato (mesma convenção dos helpers
 * de `src/lib/db/`, que recebem o `db` por parâmetro).
 */
export interface CredenciaisNfcom {
	login: string;
	senha: string;
}

export interface CriarNfcomRepositoryOptions {
	client: NfcomClient;
	/** Credenciais do gateway (login/senha) — ligadas pelo composition root. */
	credenciais: CredenciaisNfcom;
	/** TTL do cache de token (default 12h). Injetável p/ teste. */
	ttlMs?: number;
	/** Relógio injetável p/ teste (default Date.now). */
	now?: () => number;
}

function is401(err: unknown): err is NfcomApiError {
	return (
		typeof err === "object" &&
		err !== null &&
		"name" in err &&
		(err as { name: string }).name === "NfcomApiError" &&
		"status" in err &&
		(err as { status: number }).status === 401
	);
}

/** Cria um `NfcomPort` sobre um `NfcomClient`. */
export function criarNfcomRepository(
	opts: CriarNfcomRepositoryOptions,
): NfcomPort {
	const client = opts.client;
	const ttlMs = opts.ttlMs ?? TTL_12H_MS;
	const now = opts.now ?? (() => Date.now());

	let tokenCache: { token: string; expiraEm: number } | null = null;

	async function obterToken(): Promise<string> {
		if (tokenCache && now() < tokenCache.expiraEm) {
			return tokenCache.token;
		}
		const { token } = await client.auth(opts.credenciais.login, opts.credenciais.senha);
		tokenCache = { token, expiraEm: now() + ttlMs };
		return token;
	}

	function invalidarToken(): void {
		tokenCache = null;
	}

	async function emitirComRetry(input: EmitirNFComInput): Promise<EmitirNFComResultado> {
		const token = await obterToken();
		const payload = montarPayloadEmitir(input);
		try {
			const resposta = await client.emitir(token, payload);
			return traduzirResultadoEmitir(resposta);
		} catch (err) {
			if (is401(err)) {
				log.warn({ err }, "NFCom 401 ao emitir — reautenticando (caso 9)");
				invalidarToken();
				const novoToken = await obterToken();
				const resposta = await client.emitir(novoToken, payload);
				return traduzirResultadoEmitir(resposta);
			}
			throw err;
		}
	}

	return {
		async autenticar() {
			return obterToken();
		},
		async emitirNFCom(input) {
			return emitirComRetry(input);
		},
		async consultarLista(cpfcnpj, inicio, fim) {
			const token = await obterToken();
			const itens = await client.consultaLista(token, cpfcnpj, inicio, fim);
			return itens.map<NFComListaItem>((i) => ({
				chave: i.chave,
				situacao: normalizarSituacaoLeniente(i.situacao),
				protocolo: i.protocolo,
			}));
		},
	};
}
