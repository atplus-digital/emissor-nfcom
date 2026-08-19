/** Unit do worker de emissão: wrapper ALS, consolidação, correções B1 (C2/C3/M1/M2/M3). */
import { describe, expect, mock, test } from "bun:test";
import {
	consolidar,
	consolidarCobranca,
	consolidarFaturaOuCobranca,
	handleEmitFatura,
	handleEmitNfcom,
	ErroRetryable,
} from "#/workers/emissao.worker";
import type { ResultadoCobranca } from "#/domain/emissao/consolidacao";
import type { AtacadoPort } from "#/domain/ports/atacado.port";
import type { NfcomPort } from "#/domain/ports/nfcom.port";
import type { QueuePort } from "#/domain/ports/queue.port";
import { mkDb } from "../helpers/db";

describe("emissao.worker — consolidação (callback do parent)", () => {
	test("tudo ok → emitida", () => {
		const r: ResultadoCobranca[] = [
			{ cobrancaId: 1, boletoOk: true, notasOk: [true] },
			{ cobrancaId: 2, boletoOk: true, notasOk: [true, true] },
		];
		expect(consolidar(r)).toBe("emitida");
	});
	test("algum ok → parcial (caso 11)", () => {
		const r: ResultadoCobranca[] = [
			{ cobrancaId: 1, boletoOk: true, notasOk: [true] },
			{ cobrancaId: 2, boletoOk: false, notasOk: [false] },
		];
		expect(consolidar(r)).toBe("parcial");
	});
	test("nada ok → erro (caso 10)", () => {
		const r: ResultadoCobranca[] = [
			{ cobrancaId: 1, boletoOk: false, notasOk: [false] },
			{ cobrancaId: 2, boletoOk: false, notasOk: [false] },
		];
		expect(consolidar(r)).toBe("erro");
	});
	test("boleto falho mas nota ok → parcial (caso 18)", () => {
		const r: ResultadoCobranca[] = [
			{ cobrancaId: 1, boletoOk: false, notasOk: [true] },
		];
		expect(consolidar(r)).toBe("parcial");
	});
	test("sem cobranças → a-emitir (m3)", () => {
		expect(consolidar([])).toBe("a-emitir");
	});
});

describe("emissao.worker — handlers exportados (contrato)", () => {
	test("handleEmitFatura/handleEmitCobranca/handleEmitNfcom são funções", async () => {
		const w = await import("#/workers/emissao.worker");
		expect(typeof w.handleEmitFatura).toBe("function");
		expect(typeof w.handleEmitCobranca).toBe("function");
		expect(typeof w.handleEmitNfcom).toBe("function");
		expect(typeof w.criarEmissaoWorker).toBe("function");
	});
});

// ============================================================
// C2: job enfileirado só com `{faturaId}` → carrega por id (getFaturaPorId)
// ============================================================

function faturaFixture(extra: { id: number; cobrancas: any[] }) {
	return {
		parceiroId: 1,
		dataReferencia: "2026-08-01",
		dataVencimento: "2026-09-10",
		valorTotal: 10000,
		tipoFaturamento: "parceiro" as const,
		status: "a-emitir",
		...extra,
	};
}

describe("C2 — carregar fatura por id no default", () => {
	test("default usa getFaturaPorId (não buscarFaturaPorChave)", async () => {
		const db = await mkDb();
		const fatura = faturaFixture({ id: 900, cobrancas: [
			{ id: 901, faturaId: 900, valorTotal: 10000, nomeDevedor: "p", documentoDevedor: "1", emailDevedor: "e", status: "a-emitir" as const, dataVencimento: "2026-09-10", notas: [] },
		] });
		const getFaturaPorId = mock(() => Promise.resolve(fatura));
		const buscarFaturaPorChave = mock(() => Promise.resolve(null));
		const atacado = { getFaturaPorId, buscarFaturaPorChave } as unknown as AtacadoPort;
		const enqueued: string[] = [];
		// job SEM parceiroId/dataReferencia (só faturaId) → o default deve usar getFaturaPorId
		const res = await handleEmitFatura(
			{ data: { faturaId: 900 }, attemptsMade: 0, opts: {} } as any,
			{ db, atacado, asaas: {} as any, nfcom: {} as any, enqueueFilho: async (n) => { enqueued.push(n); } },
		);
		expect(getFaturaPorId).toHaveBeenCalledWith(900);
		expect(buscarFaturaPorChave).not.toHaveBeenCalled();
		expect(res.enfileiradas).toBe(1);
		expect(enqueued).toContain("emit-cobranca");
	});
});

// ============================================================
// C3: webhook enfileirado a cada mudança de estado
// ============================================================

function fakeQueue(): { queue: QueuePort; eventos: any[] } {
	const eventos: any[] = [];
	const queue = {
		async enfileirarWebhook(e: any) { eventos.push(e); },
		async enfileirarEmissaoFatura() { return { jobId: "" }; },
	} as unknown as QueuePort;
	return { queue, eventos };
}

describe("C3 — webhook disparado", () => {
	test("handleEmitFatura enfileira webhook fatura.status=emitindo", async () => {
		const db = await mkDb();
		const fatura = faturaFixture({ id: 910, cobrancas: [
			{ id: 911, faturaId: 910, valorTotal: 10000, nomeDevedor: "p", documentoDevedor: "1", emailDevedor: "e", status: "a-emitir" as const, dataVencimento: "2026-09-10", notas: [] },
		] });
		const { queue, eventos } = fakeQueue();
		await handleEmitFatura(
			{ data: { faturaId: 910 }, attemptsMade: 0, opts: {} } as any,
			{ db, atacado: { getFaturaPorId: mock(() => Promise.resolve(fatura)) } as unknown as AtacadoPort, asaas: {} as any, nfcom: {} as any, queue, enqueueFilho: async () => {} },
		);
		expect(eventos.length).toBe(1);
		expect(eventos[0].tipo).toBe("fatura.status");
		expect(eventos[0].estado).toBe("emitindo");
		expect(eventos[0].faturaId).toBe(910);
		expect(eventos[0].eventoId).toBeTruthy();
		expect(eventos[0].timestamp).toBeTruthy();
	});

	test("sem queue (deps.queue ausente) → não lança (no-op)", async () => {
		const db = await mkDb();
		const fatura = faturaFixture({ id: 920, cobrancas: [
			{ id: 921, faturaId: 920, valorTotal: 10000, nomeDevedor: "p", documentoDevedor: "1", emailDevedor: "e", status: "a-emitir" as const, dataVencimento: "2026-09-10", notas: [] },
		] });
		await handleEmitFatura(
			{ data: { faturaId: 920 }, attemptsMade: 0, opts: {} } as any,
			{ db, atacado: { getFaturaPorId: mock(() => Promise.resolve(fatura)) } as unknown as AtacadoPort, asaas: {} as any, nfcom: {} as any, enqueueFilho: async () => {} },
		);
		// sem erro — o webhook é opcional (caso 14)
		expect(true).toBe(true);
	});

	test("handleEmitNfcom enfileira webhook nfcom.situacao=emitida na 1ª emissão", async () => {
		const db = await mkDb();
		const { queue, eventos } = fakeQueue();
		const nfcom = {
			emitirNFCom: mock(() => Promise.resolve({ situacao: "autorizada", numero: 1, serie: 1, chave: "x", protocolo: "p" })),
		} as unknown as NfcomPort;
		const res = await handleEmitNfcom(
			{ data: { notaId: 700, cobrancaId: 701, faturaId: 702, destinatario: { nome: "n", cpfcnpj: "1", uf: "PR", cidade: "C", logradouro: "R", numero: "1", bairro: "B", cep: "8" }, itens: [], total: 100 } as any, attemptsMade: 0, opts: {} } as any,
			{ db, nfcom, atacado: {} as unknown as AtacadoPort, asaas: {} as any, queue },
		);
		expect(res.notaOk).toBe(true);
		expect(eventos.length).toBe(1);
		expect(eventos[0].tipo).toBe("nfcom.situacao");
		expect(eventos[0].estado).toBe("emitida");
		expect(eventos[0].alvo.notaId).toBe(700);
	});
});

// ============================================================
// M1: consolidação usa notasOk[] reais dos grandchildren
// ============================================================

describe("M1 — consolidação por grandchildren", () => {
	test("consolidarFaturaOuCobranca usa notasOk reais (não boolean do boleto)", async () => {
		const db = await mkDb();
		const { queue, eventos } = fakeQueue();
		// children values: duas cobranças, cada uma com notasOk REAIS.
		const children: Record<string, any> = {
			"1": { boletoOk: true, notasOk: [true, true] }, // 2 notas ok
			"2": { boletoOk: true, notasOk: [false] },      // 1 nota falhou → cobrança 2 não ok
		};
		const res = await consolidarFaturaOuCobranca(
			{ data: { faturaId: 800 } } as any,
			children,
			{ db, atacado: {} as unknown as AtacadoPort, asaas: {} as any, nfcom: {} as any, queue },
		);
		// cobrança 1 totalmente ok, cobrança 2 não → parcial
		expect(res.status).toBe("parcial");
		// webhook de status final também disparado
		const faturaStatus = eventos.find((e) => e.tipo === "fatura.status" && e.estado === "parcial");
		expect(faturaStatus).toBeTruthy();
		// lease liberado
		const { hasLease } = await import("#/lib/db/lease");
		expect(await hasLease(db, 800)).toBe(false);
	});

	test("nada ok → erro (notasOk todos false)", async () => {
		const db = await mkDb();
		const children: Record<string, any> = {
			"1": { boletoOk: false, notasOk: [false] },
			"2": { boletoOk: false, notasOk: [false, false] },
		};
		const res = await consolidarFaturaOuCobranca(
			{ data: { faturaId: 801 } } as any,
			children,
			{ db, atacado: {} as unknown as AtacadoPort, asaas: {} as any, nfcom: {} as any },
		);
		expect(res.status).toBe("erro");
	});
});

describe("M1 — consolidarCobranca (2ª passada do emit-cobranca)", () => {
	test("boleto resolved + notasOk dos grandchildren → {boletoOk, notasOk}", async () => {
		const db = await mkDb();
		const { acquireKey, resolveKey } = await import("#/lib/db/idempotency");
		await acquireKey(db, "cobranca:961:boleto", "asaas");
		await resolveKey(db, "cobranca:961:boleto", "bol_1");
		const job = { data: { cobrancaId: 961 } } as any;
		const childrenValues: Record<string, any> = {
			"1": { notaOk: true },
			"2": { notaOk: false },
		};
		const res = await consolidarCobranca(job, childrenValues, { db } as any);
		expect(res).toEqual({ boletoOk: true, notasOk: [true, false], erro: undefined });
	});

	test("boleto sem key (não emitido) → boletoOk false + erro", async () => {
		const db = await mkDb();
		const job = { data: { cobrancaId: 962 } } as any;
		const res = await consolidarCobranca(job, { "1": { notaOk: true } }, { db } as any);
		expect(res.boletoOk).toBe(false);
		expect(res.notasOk).toEqual([true]);
		expect(res.erro).toBe("boleto não emitido");
	});
});

describe("C2 — toResumoNota: fan-out leva o resumo completo da nota", () => {
	test("nota a-emitir → resumo com campos fiscais + itens; nota emitida é filtrada", async () => {
		const db = await mkDb();
		const endereco = { logradouro: "R", numero: "7", bairro: "B", cep: "80", cidade: "C", uf: "PR" };
		const fatura = faturaFixture({ id: 970, cobrancas: [
			{
				id: 971, faturaId: 970, valorTotal: 10000, nomeDevedor: "p", documentoDevedor: "1",
				emailDevedor: "e", status: "a-emitir" as const, dataVencimento: "2026-09-10",
				notas: [
					{
						id: 972, cobrancaId: 971, nome: "João", cpfcnpj: "52998224725", email: "j@x.com",
						rgie: "12345", telefone: "41999990000", endereco, uf: "PR", cidade: "C",
						statusInterno: "a-emitir" as const, total: 6000,
						itens: [{ descricao: "Plano", cfop: "6102", cclass: "0000", quantidade: 1, unitario: 6000, total: 6000, aliqIcms: 0, bcIcms: 0, icms: 0, incideAliquota: false }],
					},
					{
						id: 973, cobrancaId: 971, nome: "Maria", cpfcnpj: "111", email: "m@x.com",
						endereco, uf: "PR", cidade: "C", statusInterno: "emitida" as const, total: 4000, itens: [],
					},
				],
			},
		] });
		const enqueuedData: Array<[string, unknown]> = [];
		await handleEmitFatura(
			{ data: { faturaId: 970 }, attemptsMade: 0, opts: {} } as any,
			{
				db,
				atacado: { getFaturaPorId: mock(() => Promise.resolve(fatura)) } as unknown as AtacadoPort,
				asaas: {} as any, nfcom: {} as any,
				enqueueFilho: async (n: string, data: unknown) => { enqueuedData.push([n, data]); },
			},
		);
		// o child é emit-cobranca; o resumo das notas a-emitir vai no
		// EmitCobrancaData (toResumoNota carrega os campos que o emit-nfcom usa)
		const [nome, data] = enqueuedData[0] as [string, any];
		expect(nome).toBe("emit-cobranca");
		expect(data.notas).toHaveLength(1);
		expect(data.notas[0]).toMatchObject({
			notaId: 972,
			cpfcnpj: "52998224725",
			nome: "João",
			email: "j@x.com",
			rgie: "12345",
			telefone: "41999990000",
			uf: "PR",
			cidade: "C",
			logradouro: "R",
			numero: "7",
			bairro: "B",
			cep: "80",
			total: 6000,
		});
		expect(data.notas[0].itens).toHaveLength(1);
	});
});

// ============================================================
// M2: "processando" exausto marca a nota erro via outbox
// ============================================================

describe("M2 — processando exausto → nota erro", () => {
	test("última tentativa com sentinel processando → nota erro via outbox (não lança)", async () => {
		const db = await mkDb();
		const { queue, eventos } = fakeQueue();
		const nfcom = {} as unknown as NfcomPort;
		// key sentinel "processando": insert via acquireKey, então resolve c/ sentinel.
		const { acquireKey, resolveKey } = await import("#/lib/db/idempotency");
		await acquireKey(db, "nfcom:710:emitir", "nfcom");
		await resolveKey(db, "nfcom:710:emitir", "processando");
		// última tentativa (attemptsMade 4, attempts 5)
		const res = await handleEmitNfcom(
			{ data: { notaId: 710, cobrancaId: 701, faturaId: 702, destinatario: { nome: "n", cpfcnpj: "1", uf: "PR", cidade: "C", logradouro: "R", numero: "1", bairro: "B", cep: "8" }, itens: [], total: 100 } as any, attemptsMade: 4, opts: { attempts: 5 } } as any,
			{ db, nfcom, atacado: {} as unknown as AtacadoPort, asaas: {} as any, queue },
		);
		expect(res.notaOk).toBe(false);
		expect(res.statusInterno).toBe("erro");
		// outbox: nota erro + registrarErro
		const { drainOutbox } = await import("#/lib/db/outbox");
		const msgs = await drainOutbox(db, 20);
		expect(msgs.some((m) => (m.payload as any).op === "atualizarStatusNota" && (m.payload as any).statusInterno === "erro")).toBe(true);
		expect(msgs.some((m) => (m.payload as any).op === "registrarErro" && (m.payload as any).notaId === 710)).toBe(true);
		// webhook nfcom.situacao=erro
		expect(eventos.some((e) => e.tipo === "nfcom.situacao" && e.estado === "erro")).toBe(true);
	});

	test("não-última tentativa com processando → ErroRetryable (não marca erro)", async () => {
		const db = await mkDb();
		const { acquireKey, resolveKey } = await import("#/lib/db/idempotency");
		await acquireKey(db, "nfcom:711:emitir", "nfcom");
		await resolveKey(db, "nfcom:711:emitir", "processando");
		const nfcom = {} as unknown as NfcomPort;
		let threw = false;
		try {
			await handleEmitNfcom(
				{ data: { notaId: 711, cobrancaId: 701, faturaId: 702, destinatario: { nome: "n", cpfcnpj: "1", uf: "PR", cidade: "C", logradouro: "R", numero: "1", bairro: "B", cep: "8" }, itens: [], total: 100 } as any, attemptsMade: 0, opts: { attempts: 5 } } as any,
				{ db, nfcom, atacado: {} as unknown as AtacadoPort, asaas: {} as any },
			);
		} catch (e) {
			threw = e instanceof ErroRetryable;
		}
		expect(threw).toBe(true);
	});
});

// ============================================================
// M3: 0 children → releaseLease + consolida emitida imediatamente
// ============================================================

describe("M3 — 0 cobranças a-emitir → releaseLease + emitida", () => {
	test("todas cobranças já emitidas → consolida emitida e libera lease", async () => {
		const db = await mkDb();
		const { queue, eventos } = fakeQueue();
		const fatura = faturaFixture({ id: 950, cobrancas: [
			{ id: 951, faturaId: 950, valorTotal: 10000, nomeDevedor: "p", documentoDevedor: "1", emailDevedor: "e", status: "emitida" as const, dataVencimento: "2026-09-10", notas: [] },
		] });
		const enqueued: string[] = [];
		const res = await handleEmitFatura(
			{ data: { faturaId: 950 }, attemptsMade: 0, opts: {} } as any,
			{ db, atacado: { getFaturaPorId: mock(() => Promise.resolve(fatura)) } as unknown as AtacadoPort, asaas: {} as any, nfcom: {} as any, queue, enqueueFilho: async (n) => { enqueued.push(n); } },
		);
		expect(res.enfileiradas).toBe(0);
		expect(enqueued.length).toBe(0);
		// lease liberado
		const { hasLease } = await import("#/lib/db/lease");
		expect(await hasLease(db, 950)).toBe(false);
		// outbox: emitida
		const { drainOutbox } = await import("#/lib/db/outbox");
		const msgs = await drainOutbox(db, 20);
		expect(msgs.some((m) => (m.payload as any).op === "atualizarStatusFatura" && (m.payload as any).status === "emitida")).toBe(true);
		// webhook emitida
		expect(eventos.some((e) => e.tipo === "fatura.status" && e.estado === "emitida")).toBe(true);
	});
});
