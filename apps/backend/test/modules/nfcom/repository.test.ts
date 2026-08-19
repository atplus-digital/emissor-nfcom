import { describe, expect, it, mock } from "bun:test";
import { criarNfcomRepository } from "#/modules/nfcom/nfcom.repository";
import type {
	NfcomClient,
	NfcomApiError,
} from "#/modules/nfcom/nfcom.client";
import type { EmitirNFComInput } from "#/domain/ports/nfcom.port";

/** Cria um client fake com controles de chamada. */
function fakeClient(overrides: Partial<NfcomClient> = {}): {
	client: NfcomClient;
	calls: Record<string, ReturnType<typeof mock>[]>;
} {
	const calls: Record<string, ReturnType<typeof mock>[]> = {
		auth: [],
		emitir: [],
		consultaLista: [],
	};
	const authMock = mock(async () => ({ token: "TOKEN-1" }));
	const emitirMock =
		overrides.emitir ??
		(mock(async () => ({
			situacao: "AUTORIZADA",
			numero: 1,
			serie: 1,
			chave: "chave",
			protocolo: "proto",
			pdf: "pdf-url",
			xml: "xml-url",
		})));
	const consultaListaMock =
		overrides.consultaLista ??
		(mock(async () => [
			{ chave: "c1", situacao: "AUTORIZADA", protocolo: "p1" },
		]));
	const client: NfcomClient = {
		auth: authMock,
		emitir: emitirMock,
		consultaLista: consultaListaMock,
		...overrides,
	} as NfcomClient;
	calls.auth.push(authMock);
	calls.emitir.push(emitirMock);
	calls.consultaLista.push(consultaListaMock);
	return { client, calls };
}

function makeError(status: number): NfcomApiError {
	return {
		name: "NfcomApiError",
		status,
		message: `HTTP ${status}`,
	} as NfcomApiError;
}

const CRED = { login: "login-teste", senha: "senha-teste" };

/** helper: cria repo com credenciais padrão. */
function makeRepo(client: NfcomClient, opts?: { ttlMs?: number; now?: () => number }) {
	return criarNfcomRepository({ client, credenciais: CRED, ...opts });
}

const inputEmitir: EmitirNFComInput = {
	destinatario: {
		nome: "Cliente",
		cpfcnpj: "11122233344",
		endereco: {
			logradouro: "Rua",
			numero: "1",
			bairro: "Centro",
			cep: "80000000",
			cidade: "Curitiba",
			uf: "PR",
		},
		uf: "PR",
		cidade: "Curitiba",
	},
	itens: [],
};

describe("nfcom.repository — cache de token", () => {
	it("autenticar: 1ª chamada → POST /api/auth", async () => {
		const { client } = fakeClient();
		const repo = makeRepo(client, { ttlMs: 99_999 });
		const token = await repo.autenticar();
		expect(token).toBe("TOKEN-1");
		expect(client.auth).toHaveBeenCalledTimes(1);
	});

	it("autenticar: 2ª chamada dentro do TTL → não refaz HTTP", async () => {
		const { client } = fakeClient();
		const repo = makeRepo(client, { ttlMs: 99_999 });
		await repo.autenticar();
		await repo.autenticar();
		expect(client.auth).toHaveBeenCalledTimes(1);
	});

	it("autenticar: após expirar o TTL → refaz HTTP (reauth)", async () => {
		const { client } = fakeClient();
		let t = 0;
		const repo = makeRepo(client, {
			ttlMs: 100,
			now: () => t,
		});
		await repo.autenticar();
		t = 200; // expira
		const token2 = await repo.autenticar();
		expect(token2).toBe("TOKEN-1");
		expect(client.auth).toHaveBeenCalledTimes(2);
	});
});

describe("nfcom.repository — emitirNFCom", () => {
	it("happy path: usa token em cache e traduz resultado", async () => {
		const { client } = fakeClient();
		const repo = makeRepo(client, { ttlMs: 99_999 });
		const resultado = await repo.emitirNFCom(inputEmitir);
		expect(resultado.situacao).toBe("autorizada");
		expect(resultado.pdfUrl).toBe("pdf-url");
		expect(client.auth).toHaveBeenCalledTimes(1);
		expect(client.emitir).toHaveBeenCalledTimes(1);
	});

	it("caso 9: 401 → invalida cache + reauth + retry uma vez", async () => {
		let authCount = 0;
		const { client } = fakeClient({
			auth: mock(async () => ({ token: `TOKEN-${++authCount}` })),
			emitir: mock(async (token: string) => {
				if (token === "TOKEN-1") throw makeError(401);
				return {
					situacao: "AUTORIZADA",
					numero: 2,
					serie: 1,
					chave: "c2",
					protocolo: "p2",
					pdf: "pdf2",
					xml: "xml2",
				};
			}),
		});
		const repo = makeRepo(client, { ttlMs: 99_999 });
		const resultado = await repo.emitirNFCom(inputEmitir);
		expect(resultado.chave).toBe("c2");
		expect(authCount).toBe(2);
		expect(client.emitir).toHaveBeenCalledTimes(2);
	});

	it("erro não-401 propaga (não retry)", async () => {
		const { client } = fakeClient({
			emitir: mock(async () => {
				throw makeError(500);
			}),
		});
		const repo = makeRepo(client, { ttlMs: 99_999 });
		await expect(repo.emitirNFCom(inputEmitir)).rejects.toThrow("HTTP 500");
		expect(client.emitir).toHaveBeenCalledTimes(1);
	});

	it("Defeito B: rgie='ISENTO' + ieIsento injetado (FISCAL_IE_ISENTO) → fallback no payload", async () => {
		const { client } = fakeClient();
		const repo = criarNfcomRepository({ client, credenciais: CRED, ttlMs: 99_999, ieIsento: "000000000000" });
		await repo.emitirNFCom({
			...inputEmitir,
			destinatario: { ...inputEmitir.destinatario, rgie: "ISENTO" },
		});
		const payloadArg = (client.emitir.mock.calls[0] as unknown[])[1] as { rgie?: string };
		expect(payloadArg.rgie).toBe("000000000000");
	});

	it("Defeito B: rgie='ISENTO' sem ieIsento → campo omitido no payload", async () => {
		const { client } = fakeClient();
		const repo = makeRepo(client, { ttlMs: 99_999 });
		await repo.emitirNFCom({
			...inputEmitir,
			destinatario: { ...inputEmitir.destinatario, rgie: "ISENTO" },
		});
		const payloadArg = (client.emitir.mock.calls[0] as unknown[])[1] as { rgie?: string };
		expect(payloadArg.rgie).toBeUndefined();
	});

	it("não reenvia externalReference no payload", async () => {
		const { client } = fakeClient();
		const repo = makeRepo(client, { ttlMs: 99_999 });
		await repo.emitirNFCom(inputEmitir);
		const payloadArg = (client.emitir.mock.calls[0] as unknown[])[1];
		expect(JSON.stringify(payloadArg)).not.toContain("externalReference");
	});
});

describe("nfcom.repository — consultarLista", () => {
	it("retorna itens com situacao normalizada p/ domínio (lowercase)", async () => {
		const { client } = fakeClient();
		const repo = makeRepo(client, { ttlMs: 99_999 });
		const itens = await repo.consultarLista("11122233344", "2026-08-01", "2026-08-31");
		expect(itens).toHaveLength(1);
		expect(itens[0].situacao).toBe("autorizada");
		expect(itens[0].chave).toBe("c1");
	});

	it("situacao desconhecida do gateway → null (leniente, não lança)", async () => {
		const { client } = fakeClient({
			consultaLista: mock(async () => [
				{ chave: "c2", situacao: "PENDENTE", protocolo: "p2" },
			]),
		});
		const repo = makeRepo(client, { ttlMs: 99_999 });
		const itens = await repo.consultarLista("11122233344", "2026-08-01", "2026-08-31");
		expect(itens).toHaveLength(1);
		expect(itens[0].situacao).toBeNull();
	});

	it("usa token em cache (não refaz auth)", async () => {
		const { client } = fakeClient();
		const repo = makeRepo(client, { ttlMs: 99_999 });
		await repo.consultarLista("11122233344", "2026-08-01", "2026-08-31");
		await repo.consultarLista("11122233344", "2026-08-01", "2026-08-31");
		expect(client.auth).toHaveBeenCalledTimes(1);
	});
});
