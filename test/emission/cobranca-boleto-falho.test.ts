/**
 * SPEC-0001 caso 18: boleto de uma cobrança falha fatal → as notas da cobrança
 * **ainda são emitidas** (NFCom é obrigação fiscal, independe do pagamento).
 * A cobrança vai a `erro` e a fatura tende a `parcial`.
 */
import { describe, expect, mock, test } from "bun:test";
import type { AsaasPort } from "#/domain/ports/asaas.port";
import type { AtacadoPort } from "#/domain/ports/atacado.port";
import type { NfcomPort } from "#/domain/ports/nfcom.port";
import { handleEmitCobranca } from "#/workers/emissao.worker";
import { mkDb } from "../helpers/db";

describe("SPEC-0001 caso 18 — boleto falha, nota emite", () => {
	test("boleto falha → cobrança erro, MAS notas são enfileiradas", async () => {
		const db = await mkDb();
		const asaas = {
			consultarBoletoPorExternalReference: mock(() => Promise.resolve(null)),
			buscarCustomerPorDocumento: mock(() => Promise.resolve(null)),
			criarCustomer: mock(() => Promise.resolve({ id: "c", name: "n", email: "e", cpfCnpj: "1" })),
			criarBoleto: mock(() => Promise.reject(new Error("customer inválido"))),
		} as unknown as AsaasPort;
		const atacado = { atualizarStatusCobranca: mock(() => Promise.resolve()), registrarErro: mock(() => Promise.resolve()) } as unknown as AtacadoPort;
		const enqueued: string[] = [];
		const res = await handleEmitCobranca(
			{ data: { cobrancaId: 300, valorTotal: 5000, documentoDevedor: "1", nomeDevedor: "n", emailDevedor: "e", dataVencimento: "2026-09-10", notas: [{ notaId: 301, cpfcnpj: "1", nome: "x", uf: "PR", cidade: "C", logradouro: "R", numero: "1", bairro: "B", cep: "8", total: 5000, itens: [] }] }, attemptsMade: 0, opts: {} } as any,
			{ db, asaas, atacado, nfcom: {} as unknown as NfcomPort, enqueueFilho: async (name) => { enqueued.push(name); } },
		);
		expect(res.boletoOk).toBe(false);
		// nota ainda assim enfileirada
		expect(enqueued).toContain("emit-nfcom");
		expect(res.notasEnfileiradas).toBe(1);
		// cobrança marcada erro via outbox
		const { drainOutbox } = await import("#/lib/db/outbox");
		const msgs = await drainOutbox(db, 20);
		expect(msgs.some((m) => (m.payload as any).op === "atualizarStatusCobranca" && (m.payload as any).status === "erro")).toBe(true);
		expect(msgs.some((m) => (m.payload as any).op === "registrarErro" && (m.payload as any).cobrancaId === 300)).toBe(true);
	});
});
