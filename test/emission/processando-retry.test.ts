/** SPEC-0001 caso 6: NFCom retorna `processando` → job entra em retry (backoff). */
import { describe, expect, mock, test } from "bun:test";
import type { NfcomPort } from "#/domain/ports/nfcom.port";
import type { AsaasPort } from "#/domain/ports/asaas.port";
import type { AtacadoPort } from "#/domain/ports/atacado.port";
import { handleEmitNfcom } from "#/workers/emissao.worker";
import { mkDb } from "../helpers/db";

const baseData = {
	notaId: 8, cobrancaId: 1, faturaId: 1,
	destinatario: { nome: "C", cpfcnpj: "11122233344", uf: "PR", cidade: "C", logradouro: "R", numero: "1", bairro: "B", cep: "80000000" },
	itens: [], total: 10000,
};

describe("SPEC-0001 caso 6 — processando → retry", () => {
	test("situacao processando → lança ErroRetryable (BullMQ retry)", async () => {
		const db = await mkDb();
		const nfcom = {
			emitirNFCom: mock(() => Promise.resolve({
				situacao: "processando", numero: 0, serie: 0, chave: "", protocolo: "",
				pdfUrl: "", xmlUrl: "",
			})),
		} as unknown as NfcomPort;
		await expect(
			handleEmitNfcom(
				{ data: baseData, attemptsMade: 0, opts: {} } as any,
				{ db, nfcom, asaas: {} as any, atacado: {} as any },
			),
		).rejects.toThrow(/processando/);
		// não marcou a nota como erro — permanece a-emitir (retry)
		const { drainOutbox } = await import("#/lib/db/outbox");
		const msgs = await drainOutbox(db, 10);
		expect(msgs.some((m) => (m.payload as any).op === "registrarErro")).toBe(false);
	});

	test("retry após processando (sentinel) → NÃO dispara caso 15, continua retry", async () => {
		// Na 1ª tentativa o gateway retornou processando: o handler resolveu a key
		// com sentinel "processando" e lançou retryable. Na 2ª tentativa, a key está
		// resolved (sentinel) — o handler deve continuar retrying, NÃO marcar erro
		// (caso 15 é para crash pós-POST sem ack do gateway, não para processando).
		const db = await mkDb();
		const { idempotencyKeys } = await import("#/lib/db/schema");
		await db.insert(idempotencyKeys).values({
			key: `nfcom:${baseData.notaId}:emitir`,
			target: "nfcom",
			externalId: "processando",
			status: "resolved",
			createdAt: "2026-08-17T00:00:00Z",
			updatedAt: "2026-08-17T00:00:00Z",
		});
		const nfcom = {
			emitirNFCom: mock(() => Promise.reject(new Error("não deve re-emitir"))),
		} as unknown as NfcomPort;

		await expect(
			handleEmitNfcom(
				{ data: baseData, attemptsMade: 1, opts: {} } as any,
				{ db, nfcom, asaas: {} as any, atacado: {} as any },
			),
		).rejects.toThrow(/processando/);
		// não re-emite, não marca erro, não registra erro
		expect(nfcom.emitirNFCom).toHaveBeenCalledTimes(0);
		const { drainOutbox } = await import("#/lib/db/outbox");
		const msgs = await drainOutbox(db, 10);
		expect(msgs.some((m) => (m.payload as any).op === "atualizarStatusNota" && (m.payload as any).statusInterno === "erro")).toBe(false);
		expect(msgs.some((m) => (m.payload as any).op === "registrarErro")).toBe(false);
	});
});
