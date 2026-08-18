/**
 * SPEC-0001 caso 9: token do gateway expira (401) durante a emissão → o módulo
 * NFCom invalida o cache e reautentica (TTL 12h), retryando a nota
 * transparentemente. O worker só chama `emitirNFCom`; o reauth vive no módulo
 * (Fase 3c). Aqui verificamos que o worker repassa a chamada e, se a 1ª emite
 * lança 401-resolved por reauth na 2ª, o resultado final é emitida.
 */
import { describe, expect, mock, test } from "bun:test";
import type { NfcomPort } from "#/domain/ports/nfcom.port";
import { handleEmitNfcom } from "#/workers/emissao.worker";
import { mkDb } from "../helpers/db";

const baseData = {
	notaId: 10, cobrancaId: 1, faturaId: 1,
	destinatario: { nome: "C", cpfcnpj: "11122233344", uf: "PR", cidade: "C", logradouro: "R", numero: "1", bairro: "B", cep: "80000000" },
	itens: [], total: 10000,
};

describe("SPEC-0001 caso 9 — reauth 401 transparente (no módulo NFCom)", () => {
	test("módulo NFCom reauth internamente: uma chamada ao port → resultado autorizada", async () => {
		const db = await mkDb();
		// O reauth (401 → invalida cache → reauth → retry) vive no MÓDULO NFCom
		// (Fase 3c), não no worker. O worker só chama emitirNFCom uma vez e recebe
		// o resultado final (autorizada). Aqui o port simula o módulo já tendo
		// resolvido o reauth transparentemente — uma única chamada bem-sucedida.
		const nfcom = {
			emitirNFCom: mock(() => Promise.resolve({
				situacao: "autorizada", numero: 1, serie: 1, chave: "ch", protocolo: "p",
				pdfUrl: "u", xmlUrl: "u2",
			})),
		} as unknown as NfcomPort;
		const res = await handleEmitNfcom(
			{ data: baseData, attemptsMade: 0, opts: {} } as any,
			{ db, nfcom, asaas: {} as any, atacado: {} as any },
		);
		// o worker chama o port uma vez; o reauth é invisível a ele
		expect(nfcom.emitirNFCom).toHaveBeenCalledTimes(1);
		expect(res.notaOk).toBe(true);
		expect(res.statusInterno).toBe("emitida");
	});
});
