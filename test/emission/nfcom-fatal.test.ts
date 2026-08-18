/** SPEC-0001 caso 7: NFCom retorna rejeitada/cancelada → erro fatal, sem retry. */
import { describe, expect, mock, test } from "bun:test";
import type { NfcomPort } from "#/domain/ports/nfcom.port";
import { handleEmitNfcom } from "#/workers/emissao.worker";
import { mkDb } from "../helpers/db";

const baseData = {
	notaId: 9, cobrancaId: 1, faturaId: 1,
	destinatario: { nome: "C", cpfcnpj: "11122233344", uf: "PR", cidade: "C", logradouro: "R", numero: "1", bairro: "B", cep: "80000000" },
	itens: [], total: 10000,
};

describe("SPEC-0001 caso 7 — rejeitada/cancelada → fatal (sem retry)", () => {
	test("rejeitada → statusInterno=erro, não lança retryable", async () => {
		const db = await mkDb();
		const nfcom = {
			emitirNFCom: mock(() => Promise.resolve({
				situacao: "rejeitada", numero: 0, serie: 0, chave: "ch", protocolo: "p",
				pdfUrl: "", xmlUrl: "",
			})),
		} as unknown as NfcomPort;
		const res = await handleEmitNfcom(
			{ data: baseData, attemptsMade: 0, opts: {} } as any,
			{ db, nfcom, asaas: {} as any, atacado: {} as any },
		);
		expect(res.notaOk).toBe(false);
		expect(res.statusInterno).toBe("erro");
	});
	test("cancelada (reportada pelo gateway) → erro (não cancelada — reservada à SPEC-0003)", async () => {
		const db = await mkDb();
		const nfcom = {
			emitirNFCom: mock(() => Promise.resolve({
				situacao: "cancelada", numero: 0, serie: 0, chave: "ch", protocolo: "p",
				pdfUrl: "", xmlUrl: "",
			})),
		} as unknown as NfcomPort;
		const res = await handleEmitNfcom(
			{ data: baseData, attemptsMade: 0, opts: {} } as any,
			{ db, nfcom, asaas: {} as any, atacado: {} as any },
		);
		expect(res.statusInterno).toBe("erro");
		expect(res.notaOk).toBe(false);
	});
});
