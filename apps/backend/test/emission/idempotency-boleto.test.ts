/**
 * SPEC-0001 caso 5: o boleto foi criado no Asaas mas a persistência falhou
 * (crash antes do outbox relay). No reprocessamento, a idempotency key resolve
 * e o `f_id_externo` é reutilizado — **sem boleto duplicado**.
 *
 * Estratégia (ADR-0003 item 4 / Asaas): antes de criar, CONSULTA o Asaas por
 * externalReference `cobranca:{id}`; se acha, resolve a key com o retorno e
 * NÃO re-emite.
 */
import { describe, expect, mock, test } from "bun:test";
import type { AtacadoPort } from "#/domain/ports/atacado.port";
import type { AsaasPort } from "#/domain/ports/asaas.port";
import type { NfcomPort } from "#/domain/ports/nfcom.port";
import { handleEmitCobranca } from "#/workers/emissao.worker";
import { mkDb } from "../helpers/db";
import { idempotencyKeys } from "@emissor/db/schema";

describe("SPEC-0001 caso 5 — idempotência de boleto (consult-before-re-emit)", () => {
	test("key já resolvida → reutiliza idExterno, não chama Asaas", async () => {
		const db = await mkDb();
		const cobrancaId = 100;
		// key já resolvida (boleto criado antes do crash, external_id persistido)
		await db.insert(idempotencyKeys).values({
			key: `cobranca:${cobrancaId}:boleto`,
			target: "asaas",
			externalId: "pay_existing",
			status: "resolved",
			createdAt: "2026-08-17T00:00:00Z",
			updatedAt: "2026-08-17T00:00:00Z",
		});

		const asaas = {
			consultarBoletoPorExternalReference: mock(() =>
				Promise.resolve({ idExterno: "pay_existing", linkFatura: "http://link-reuse" }),
			),
			criarBoleto: mock(() => Promise.reject(new Error("não deve chamar"))),
			buscarCustomerPorDocumento: mock(() => Promise.resolve(null)),
			criarCustomer: mock(() =>
				Promise.resolve({ id: "cus_x", name: "P", email: "e", cpfCnpj: "1" }),
			),
			atualizarCustomer: mock(() => Promise.resolve({} as any)),
		} as unknown as AsaasPort;
		const atacado = {
			atualizarStatusCobranca: mock(() => Promise.resolve()),
			registrarErro: mock(() => Promise.resolve()),
		} as unknown as AtacadoPort;
		const nfcom = {} as unknown as NfcomPort;

		const res = await handleEmitCobranca(
			{ data: { cobrancaId, valorTotal: 10000, documentoDevedor: "11122233344", nomeDevedor: "P", emailDevedor: "e", dataVencimento: "2026-09-10", notas: [] }, attemptsMade: 0, opts: {} } as any,
			{ db, asaas, atacado, nfcom, enqueueFilho: () => Promise.resolve() },
		);

		expect(asaas.criarBoleto).toHaveBeenCalledTimes(0);
		// m3: no reuse path, re-busca o linkFatura via consultarBoletoPorExternalReference
		// (a key só guarda externalId, não o link; sem re-busca, o link é perdido)
		expect(asaas.consultarBoletoPorExternalReference).toHaveBeenCalledWith(`cobranca:${cobrancaId}`);
		// o worker escreve via outbox (não chama atacado direto) — o relay entrega
		const { drainOutbox } = await import("@emissor/db/outbox");
		const msgs = await drainOutbox(db, 10);
		const statusMsg = msgs.find((m) => (m.payload as any).op === "atualizarStatusCobranca");
		expect(statusMsg?.payload).toMatchObject({
			id: cobrancaId,
			status: "emitida",
			extra: expect.objectContaining({ idExterno: "pay_existing", linkFatura: "http://link-reuse" }),
		});
		expect(res.boletoOk).toBe(true);
	});

	test("key in_progress pós-crash → consulta Asaas por externalReference, acha, resolve e não duplica", async () => {
		const db = await mkDb();
		const cobrancaId = 101;
		// key ficou in_progress (crash entre POST e resolveKey)
		await db.insert(idempotencyKeys).values({
			key: `cobranca:${cobrancaId}:boleto`,
			target: "asaas",
			externalId: null,
			status: "in_progress",
			createdAt: "2026-08-17T00:00:00Z",
			updatedAt: "2026-08-17T00:00:00Z",
		});

		const asaas = {
			// a consulta ACHA o boleto criado antes do crash
			consultarBoletoPorExternalReference: mock(() =>
				Promise.resolve({ idExterno: "pay_recovered", linkFatura: "http://link" }),
			),
			criarBoleto: mock(() => Promise.reject(new Error("não deve duplicar"))),
			buscarCustomerPorDocumento: mock(() => Promise.resolve(null)),
			criarCustomer: mock(() =>
				Promise.resolve({ id: "cus_x", name: "P", email: "e", cpfCnpj: "1" }),
			),
			atualizarCustomer: mock(() => Promise.resolve({} as any)),
		} as unknown as AsaasPort;
		const atacado = {
			atualizarStatusCobranca: mock(() => Promise.resolve()),
			registrarErro: mock(() => Promise.resolve()),
		} as unknown as AtacadoPort;
		const nfcom = {} as unknown as NfcomPort;

		const res = await handleEmitCobranca(
			{ data: { cobrancaId, valorTotal: 10000, documentoDevedor: "11122233344", nomeDevedor: "P", emailDevedor: "e", dataVencimento: "2026-09-10", notas: [] }, attemptsMade: 1, opts: {} } as any,
			{ db, asaas, atacado, nfcom, enqueueFilho: () => Promise.resolve() },
		);

		expect(asaas.consultarBoletoPorExternalReference).toHaveBeenCalledWith(
			`cobranca:${cobrancaId}`,
		);
		expect(asaas.criarBoleto).toHaveBeenCalledTimes(0);
		// o worker enfileira o status via outbox
		const { drainOutbox } = await import("@emissor/db/outbox");
		const msgs = await drainOutbox(db, 10);
		const statusMsg = msgs.find((m) => (m.payload as any).op === "atualizarStatusCobranca");
		expect(statusMsg?.payload).toMatchObject({
			id: cobrancaId,
			status: "emitida",
			extra: expect.objectContaining({ idExterno: "pay_recovered", linkFatura: "http://link" }),
		});
		expect(res.boletoOk).toBe(true);
		// key resolvida com o id recuperado
		const { getKey } = await import("@emissor/db/idempotency");
		const key = await getKey(db, `cobranca:${cobrancaId}:boleto`);
		expect(key?.status).toBe("resolved");
		expect(key?.externalId).toBe("pay_recovered");
	});
});
