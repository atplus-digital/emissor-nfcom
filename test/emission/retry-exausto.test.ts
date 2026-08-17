/**
 * SPEC-0001 caso 17: BullMQ exaure as tentativas (5) → item vai para `erro` via
 * outbox, job fica `failed` no Board; consolidação prossegue. O handler marca
 * erro no outbox quando a tentativa final falha (attemptsMade === attempts-1).
 */
import { describe, expect, mock, test } from "bun:test";
import type { NfcomPort } from "#/domain/ports/nfcom.port";
import { handleEmitNfcom } from "#/workers/emissao.worker";
import { mkDb } from "../helpers/db";

const baseData = {
	notaId: 11, cobrancaId: 1, faturaId: 1,
	destinatario: { nome: "C", cpfcnpj: "11122233344", uf: "PR", cidade: "C", logradouro: "R", numero: "1", bairro: "B", cep: "80000000" },
	itens: [], total: 10000,
};

describe("SPEC-0001 caso 17 — retry exausto → erro via outbox", () => {
	test("erro local na última tentativa → statusInterno=erro + registrarErro", async () => {
		const db = await mkDb();
		const nfcom = {
			emitirNFCom: mock(() => Promise.reject(new Error("timeout gateway"))),
		} as unknown as NfcomPort;
		const res = await handleEmitNfcom(
			{ data: baseData, attemptsMade: 4, opts: { attempts: 5 } } as any,
			{ db, nfcom, asaas: {} as any, atacado: {} as any, cfop: "6102", cclass: "X" },
		);
		expect(res.statusInterno).toBe("erro");
		expect(res.notaOk).toBe(false);
		const { drainOutbox } = await import("#/lib/db/outbox");
		const msgs = await drainOutbox(db, 10);
		expect(msgs.some((m) => (m.payload as any).op === "registrarErro" && (m.payload as any).notaId === 11)).toBe(true);
	});
});
