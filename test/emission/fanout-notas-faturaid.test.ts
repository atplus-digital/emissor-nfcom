/**
 * Regressão: o fan-out `emit-cobranca → emit-nfcom` precisava propagar o
 * `faturaId` real no data do job. Antes da correção, `toNfcomData` hardcodeava
 * `faturaId: 0` (comentário dizia "preenchido pelo wiring", mas o wiring só
 * injetava `{parent}` nos options do BullMQ, nunca no `data`) — o que quebrava
 * a correlação dos webhooks `nfcom.situacao` e o namespace de dedup
 * `webhook:{faturaId}:{eventoId}` (SPEC-0001).
 */
import { describe, expect, mock, test } from "bun:test";
import type { AsaasPort } from "#/domain/ports/asaas.port";
import type { AtacadoPort } from "#/domain/ports/atacado.port";
import type { NfcomPort } from "#/domain/ports/nfcom.port";
import { handleEmitCobranca } from "#/workers/emissao.worker";
import { mkDb } from "../helpers/db";

describe("fan-out emit-nfcom propaga faturaId real", () => {
	test("job emit-nfcom enfileirado carrega faturaId do parent (não 0)", async () => {
		const db = await mkDb();
		const asaas = {
			consultarBoletoPorExternalReference: mock(() => Promise.resolve(null)),
			buscarCustomerPorDocumento: mock(() => Promise.resolve({ id: "c", name: "n", email: "e", cpfCnpj: "1" })),
			atualizarCustomer: mock(() => Promise.resolve()),
			criarBoleto: mock(() => Promise.resolve({ idExterno: "b1", linkFatura: "https://x" })),
		} as unknown as AsaasPort;
		const atacado = { atualizarStatusCobranca: mock(() => Promise.resolve()), registrarErro: mock(() => Promise.resolve()) } as unknown as AtacadoPort;
		const enqueued: { nome: string; data: any }[] = [];
		const res = await handleEmitCobranca(
			{
				data: {
					cobrancaId: 300,
					faturaId: 301,
					valorTotal: 5000,
					documentoDevedor: "1",
					nomeDevedor: "n",
					emailDevedor: "e",
					dataVencimento: "2026-09-10",
					notas: [
						{ notaId: 302, cpfcnpj: "1", nome: "x", uf: "PR", cidade: "C", logradouro: "R", numero: "1", bairro: "B", cep: "8", total: 5000, itens: [] },
					],
				},
				attemptsMade: 0,
				opts: {},
			} as any,
			{ db, asaas, atacado, nfcom: {} as unknown as NfcomPort, enqueueFilho: async (nome, data) => { enqueued.push({ nome, data }); } },
		);
		expect(res.boletoOk).toBe(true);
		expect(res.notasEnfileiradas).toBe(1);
		expect(enqueued).toHaveLength(1);
		expect(enqueued[0].nome).toBe("emit-nfcom");
		// a asserção que faltava (o bug): o faturaId no data do job
		expect(enqueued[0].data.faturaId).toBe(301);
		expect(enqueued[0].data.faturaId).not.toBe(0);
		expect(enqueued[0].data.notaId).toBe(302);
		expect(enqueued[0].data.cobrancaId).toBe(300);
	});
});
