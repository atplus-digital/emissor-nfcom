/**
 * SPEC-0001 caso 15: o processo cai após `POST /api/emitir`, antes de resolver
 * a idempotency key da nota. No retry, o job **não re-emite** (zero
 * auto-duplicação): a key está em-progresso e não resolvida (job stalled/órfão),
 * então marca a nota como erro (suspeita de emissão) + registra em t_nfcom_erros
 * para inspeção manual.
 */
import { describe, expect, mock, test } from "bun:test";
import type { AtacadoPort } from "#/domain/ports/atacado.port";
import type { AsaasPort } from "#/domain/ports/asaas.port";
import type { NfcomPort } from "#/domain/ports/nfcom.port";
import { handleEmitNfcom } from "#/workers/emissao.worker";
import { mkDb } from "../helpers/db";
import { idempotencyKeys } from "#/lib/db/schema";

const baseData = {
	notaId: 7,
	cobrancaId: 100,
	faturaId: 1,
	destinatario: {
		nome: "Cliente", cpfcnpj: "11122233344", uf: "PR", cidade: "Curitiba",
		logradouro: "R", numero: "1", bairro: "B", cep: "80000000",
	},
	itens: [], total: 10000,
};

describe("SPEC-0001 caso 15 — dedup de nota (não re-emite → inspeção)", () => {
	test("retry com key in_progress não resolvida → não re-emite, marca erro + inspeção", async () => {
		const db = await mkDb();
		await db.insert(idempotencyKeys).values({
			key: `nfcom:${baseData.notaId}:emitir`,
			target: "nfcom",
			externalId: null,
			status: "in_progress",
			createdAt: "2026-08-17T00:00:00Z",
			updatedAt: "2026-08-17T00:00:00Z",
		});
		const nfcom = {
			emitirNFCom: mock(() => Promise.reject(new Error("não deve re-emitir"))),
			autenticar: mock(() => Promise.resolve("tok")),
			consultarLista: mock(() => Promise.resolve([])),
		} as unknown as NfcomPort;

		const res = await handleEmitNfcom(
			{ data: baseData, attemptsMade: 1, opts: {} } as any,
			{ db, nfcom, asaas: {} as any, atacado: {} as any, cfop: "6102", cclass: "X" },
		);

		expect(nfcom.emitirNFCom).toHaveBeenCalledTimes(0);
		expect(res.notaOk).toBe(false);
		expect(res.statusInterno).toBe("erro");
		const { drainOutbox } = await import("#/lib/db/outbox");
		const msgs = await drainOutbox(db, 10);
		expect(msgs.some((m) => (m.payload as any).op === "atualizarStatusNota" && (m.payload as any).statusInterno === "erro")).toBe(true);
		expect(msgs.some((m) => (m.payload as any).op === "registrarErro" && (m.payload as any).notaId === baseData.notaId)).toBe(true);
	});

	test("1ª tentativa com key in_progress → emite normalmente", async () => {
		const db = await mkDb();
		const nfcom = {
			emitirNFCom: mock(() => Promise.resolve({
				situacao: "autorizada", numero: 1, serie: 1, chave: "ch", protocolo: "p",
				pdfUrl: "http://pdf", xmlUrl: "http://xml",
			})),
			autenticar: mock(() => Promise.resolve("tok")),
			consultarLista: mock(() => Promise.resolve([])),
		} as unknown as NfcomPort;

		const res = await handleEmitNfcom(
			{ data: baseData, attemptsMade: 0, opts: {} } as any,
			{ db, nfcom, asaas: {} as any, atacado: {} as any, cfop: "6102", cclass: "X" },
		);
		expect(nfcom.emitirNFCom).toHaveBeenCalledTimes(1);
		expect(res.notaOk).toBe(true);
		expect(res.statusInterno).toBe("emitida");
	});

	test("key já resolvida → reutiliza, não re-emite", async () => {
		const db = await mkDb();
		await db.insert(idempotencyKeys).values({
			key: `nfcom:${baseData.notaId}:emitir`,
			target: "nfcom",
			externalId: "chave_existente",
			status: "resolved",
			createdAt: "2026-08-17T00:00:00Z",
			updatedAt: "2026-08-17T00:00:00Z",
		});
		const nfcom = {
			emitirNFCom: mock(() => Promise.reject(new Error("não deve re-emitir"))),
			autenticar: mock(() => Promise.resolve("tok")),
			consultarLista: mock(() => Promise.resolve([])),
		} as unknown as NfcomPort;
		const res = await handleEmitNfcom(
			{ data: baseData, attemptsMade: 0, opts: {} } as any,
			{ db, nfcom, asaas: {} as any, atacado: {} as any, cfop: "6102", cclass: "X" },
		);
		expect(nfcom.emitirNFCom).toHaveBeenCalledTimes(0);
		expect(res.notaOk).toBe(true);
		expect(res.statusInterno).toBe("emitida");
	});
});
