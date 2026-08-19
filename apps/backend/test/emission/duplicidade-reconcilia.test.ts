/**
 * Issue #4 — Falha B: `Duplicidade de NFCom` (HTTP 500 do gateway) significa que
 * a nota JÁ foi autorizada por uma emissão anterior (cuja key se perdeu — ex.:
 * banco de coordenação resetado entre POST e resolveKey). Em vez de marcar a nota
 * como `erro` (estado inconsistente: f_status_interno=erro + f_situacao=autorizada),
 * o handler reconcilia via `/api/lista`: localiza a nota AUTORIZADA do destinatário
 * na janela curta e marca `emitida` com a chave/protocolo reais.
 *
 * Se a duplicidade não localiza a nota na lista (sem prova), NÃO assume `emitida`:
 * vai a `erro` + inspeção (`NFCOM_DEDUP`).
 */
import { describe, expect, mock, test } from "bun:test";
import type { NfcomPort } from "#/domain/ports/nfcom.port";
import type { QueuePort } from "#/domain/ports/queue.port";
import { handleEmitNfcom } from "#/workers/emissao.worker";
import { mkDb } from "../helpers/db";

const baseData = {
	notaId: 55, cobrancaId: 100, faturaId: 1,
	destinatario: { nome: "Cliente", cpfcnpj: "11122233344", uf: "PR", cidade: "Curitiba", logradouro: "R", numero: "1", bairro: "B", cep: "80000000" },
	itens: [], total: 10000,
};

/** Erro do gateway no formato real: NfcomApiError (HTTP 500 + body `status: Erro`). */
function duplicidadeError(): Error {
	const e = new Error(
		'NFCom HTTP 500: {"status":"Erro","motivo":"Duplicidade de NFCom [nProt:3422600013801226]"}',
	) as Error & { status: number; name: string };
	e.name = "NfcomApiError";
	e.status = 500;
	return e;
}

/** Fake de NfcomPort com controles de chamada (estilo dos demais testes de emission). */
function nfcomFake(overrides: {
	emitirNFCom?: () => Promise<never>;
	consultarLista?: () => Promise<{ chave: string; situacao: string; protocolo: string }[]>;
} = {}) {
	return {
		emitirNFCom: mock(overrides.emitirNFCom ?? (() => Promise.reject(new Error("não deve emitir")))),
		autenticar: mock(() => Promise.resolve("tok")),
		consultarLista: mock(overrides.consultarLista ?? (() => Promise.resolve([]))),
	} as unknown as NfcomPort;
}

describe("Issue #4 — duplicidade NFCom reconcilia para emitida (Falha B)", () => {
	test("emitirNFCom rejeita c/ duplicidade e /api/lista acha a nota autorizada → reconciliada emitida", async () => {
		const db = await mkDb();
		const nfcom = nfcomFake({
			emitirNFCom: () => Promise.reject(duplicidadeError()),
			consultarLista: () => Promise.resolve([
				{ chave: "ch-real", situacao: "autorizada", protocolo: "p-real" },
			]),
		});
		// deps.queue presente p/ capturar o webhook de emitida (C3)
		const webhooks: { estado: string }[] = [];
		const queue = {
			enfileirarWebhook: mock((ev: { estado: string }) => {
				webhooks.push({ estado: ev.estado });
				return Promise.resolve();
			}),
		} as unknown as QueuePort;

		const res = await handleEmitNfcom(
			{ data: baseData, attemptsMade: 0, opts: {} } as any,
			{ db, nfcom, asaas: {} as any, atacado: {} as any, queue },
		);

		expect(res.notaOk).toBe(true);
		expect(res.statusInterno).toBe("emitida");
		// key resolvida com a chave REAL da lista
		const { getKey } = await import("@emissor/db/idempotency");
		const k = await getKey(db, `nfcom:${baseData.notaId}:emitir`);
		expect(k?.status).toBe("resolved");
		expect(k?.externalId).toBe("ch-real");
		// outbox: atualizarStatusNota emitida com chave/protocolo reais; SEM registrarErro
		const { drainOutbox } = await import("@emissor/db/outbox");
		const msgs = await drainOutbox(db, 10);
		const nota = msgs.find((m) => (m.payload as any).op === "atualizarStatusNota");
		expect(nota).toBeDefined();
		expect((nota!.payload as any).statusInterno).toBe("emitida");
		expect((nota!.payload as any).situacao).toBe("autorizada");
		expect((nota!.payload as any).chave).toBe("ch-real");
		expect((nota!.payload as any).protocolo).toBe("p-real");
		expect(msgs.some((m) => (m.payload as any).op === "registrarErro")).toBe(false);
		// webhook de emitida enfileirado (C3)
		expect(webhooks.some((w) => w.estado === "emitida")).toBe(true);
	});

	test("duplicidade sem nota localizada na inspeção → erro + NFCOM_DEDUP (não assume emitida)", async () => {
		const db = await mkDb();
		const nfcom = nfcomFake({
			emitirNFCom: () => Promise.reject(duplicidadeError()),
			consultarLista: () => Promise.resolve([]),
		});

		const res = await handleEmitNfcom(
			{ data: baseData, attemptsMade: 0, opts: {} } as any,
			{ db, nfcom, asaas: {} as any, atacado: {} as any },
		);

		expect(res.notaOk).toBe(false);
		expect(res.statusInterno).toBe("erro");
		expect(res.erro).toContain("Duplicidade de NFCom sem nota localizada");
		const { drainOutbox } = await import("@emissor/db/outbox");
		const msgs = await drainOutbox(db, 10);
		expect(msgs.some((m) => (m.payload as any).op === "atualizarStatusNota" && (m.payload as any).statusInterno === "erro")).toBe(true);
		const erro = msgs.find((m) => (m.payload as any).op === "registrarErro");
		expect(erro).toBeDefined();
		expect((erro!.payload as any).erro).toBe("NFCOM_DEDUP");
	});

	test("erro NÃO de duplicidade → caminho normal de erro (NFCOM), sem consultar lista", async () => {
		const db = await mkDb();
		const nfcom = nfcomFake({
			emitirNFCom: () => Promise.reject(new Error("NFCom HTTP 500: Falha no schema XML")),
			consultarLista: () => Promise.resolve([{ chave: "x", situacao: "autorizada", protocolo: "p" }]),
		});

		const res = await handleEmitNfcom(
			{ data: baseData, attemptsMade: 0, opts: {} } as any,
			{ db, nfcom, asaas: {} as any, atacado: {} as any },
		);

		expect(res.notaOk).toBe(false);
		expect(res.statusInterno).toBe("erro");
		// não consultou a lista (não é duplicidade)
		expect(nfcom.consultarLista).toHaveBeenCalledTimes(0);
		const { drainOutbox } = await import("@emissor/db/outbox");
		const msgs = await drainOutbox(db, 10);
		const erro = msgs.find((m) => (m.payload as any).op === "registrarErro");
		expect(erro).toBeDefined();
		expect((erro!.payload as any).erro).toBe("NFCOM");
	});

	test("duplicidade + inspeção /api/lista FALHA (lança) → caminho conservador: erro + NFCOM_DEDUP, não propaga", async () => {
		// Robustez do Fix 2: `consultarLista` não tem retry de reauth (só `emitirComRetry`
		// tem). Se a inspeção lança (rede/timeout/401), o erro NÃO pode escapar do catch
		// — deixaria a nota em `a-emitir` sem outbox e falharia o job exausto no BullMQ.
		// Deve cair no caminho conservador (erro + inspeção NFCOM_DEDUP).
		const db = await mkDb();
		const nfcom = nfcomFake({
			emitirNFCom: () => Promise.reject(duplicidadeError()),
			consultarLista: () => Promise.reject(new Error("NFCom HTTP 500: timeout na inspeção")),
		});

		const res = await handleEmitNfcom(
			{ data: baseData, attemptsMade: 0, opts: {} } as any,
			{ db, nfcom, asaas: {} as any, atacado: {} as any },
		);

		expect(res.notaOk).toBe(false);
		expect(res.statusInterno).toBe("erro");
		expect(res.erro).toContain("Duplicidade de NFCom sem nota localizada");
		const { drainOutbox } = await import("@emissor/db/outbox");
		const msgs = await drainOutbox(db, 10);
		expect(msgs.some((m) => (m.payload as any).op === "atualizarStatusNota" && (m.payload as any).statusInterno === "erro")).toBe(true);
		const erro = msgs.find((m) => (m.payload as any).op === "registrarErro");
		expect(erro).toBeDefined();
		expect((erro!.payload as any).erro).toBe("NFCOM_DEDUP");
	});
});
