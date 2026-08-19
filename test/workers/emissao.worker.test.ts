/** Unit do worker de emissão: wrapper ALS, consolidação, correções B1 (C2/C3/M1/M2/M3). */
import { describe, expect, mock, test } from "bun:test";
import {
	consolidar,
	consolidarCobranca,
	consolidarCobrancaPorEstado,
	consolidarFaturaOuCobranca,
	consolidarFaturaPorEstado,
	decidirPassadaEmissao,
	handleEmitCobranca,
	handleEmitFatura,
	handleEmitNfcom,
	ErroRetryable,
	numeroDaChave,
	processarJobEmissao,
	type WorkerCtx,
} from "#/workers/emissao.worker";
import type { ResultadoCobranca } from "#/domain/emissao/consolidacao";
import type { AtacadoPort } from "#/domain/ports/atacado.port";
import type { NfcomPort } from "#/domain/ports/nfcom.port";
import type { QueuePort } from "#/domain/ports/queue.port";
import { WaitingChildrenError } from "bullmq";
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

describe("M3 — 0 cobranças a-emitir → releaseLease + consolida pelo estado real", () => {
	test("todas cobranças já emitidas → consolida emitida e libera lease", async () => {
		const db = await mkDb();
		const { queue, eventos } = fakeQueue();
		const fatura = faturaFixture({ id: 950, cobrancas: [
			{ id: 951, faturaId: 950, valorTotal: 10000, nomeDevedor: "p", documentoDevedor: "1", emailDevedor: "e", status: "emitida" as const, dataVencimento: "2026-09-10", notas: [
				{ id: 952, cobrancaId: 951, nome: "n", cpfcnpj: "1", endereco: { logradouro: "R", numero: "1", bairro: "B", cep: "8", cidade: "C", uf: "PR" }, uf: "PR", cidade: "C", statusInterno: "emitida" as const, total: 10000, itens: [] },
			] },
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

// ============================================================
// A3: M3 não hardcode `emitida` — deriva do estado real das cobranças
// ============================================================

describe("A3 — M3 consolida pelo estado real (não hardcode emitida)", () => {
	test("1 cobrança emitida + 1 em erro → fatura parcial (não emitida)", async () => {
		const db = await mkDb();
		const { queue, eventos } = fakeQueue();
		const endereco = { logradouro: "R", numero: "1", bairro: "B", cep: "8", cidade: "C", uf: "PR" };
		const nota = (id: number, st: "emitida" | "erro") => ({
			id, cobrancaId: 960, nome: "n", cpfcnpj: "1", endereco, uf: "PR", cidade: "C",
			statusInterno: st, total: 5000, itens: [],
		});
		const fatura = faturaFixture({ id: 960, cobrancas: [
			{ id: 961, faturaId: 960, valorTotal: 5000, nomeDevedor: "p", documentoDevedor: "1", emailDevedor: "e", status: "emitida" as const, dataVencimento: "2026-09-10", notas: [nota(962, "emitida")] },
			{ id: 963, faturaId: 960, valorTotal: 5000, nomeDevedor: "p", documentoDevedor: "1", emailDevedor: "e", status: "erro" as const, dataVencimento: "2026-09-10", notas: [nota(964, "erro")] },
		] });
		const res = await handleEmitFatura(
			{ data: { faturaId: 960 }, attemptsMade: 0, opts: {} } as any,
			{ db, atacado: { getFaturaPorId: mock(() => Promise.resolve(fatura)) } as unknown as AtacadoPort, asaas: {} as any, nfcom: {} as any, queue, enqueueFilho: async () => {} },
		);
		expect(res.enfileiradas).toBe(0);
		// outbox: status final parcial (com A3; antes daria emitida hardcoded)
		const { drainOutbox } = await import("#/lib/db/outbox");
		const msgs = await drainOutbox(db, 20);
		expect(msgs.some((m) => (m.payload as any).op === "atualizarStatusFatura" && (m.payload as any).status === "parcial")).toBe(true);
		expect(msgs.some((m) => (m.payload as any).op === "atualizarStatusFatura" && (m.payload as any).status === "emitida")).toBe(false);
		// webhook parcial + lease liberado (sem 2ª passada p/ fazê-lo)
		expect(eventos.some((e) => e.tipo === "fatura.status" && e.estado === "parcial")).toBe(true);
		const { hasLease } = await import("#/lib/db/lease");
		expect(await hasLease(db, 960)).toBe(false);
	});

	test("tudo em erro → fatura erro", async () => {
		const db = await mkDb();
		const endereco = { logradouro: "R", numero: "1", bairro: "B", cep: "8", cidade: "C", uf: "PR" };
		const fatura = faturaFixture({ id: 965, cobrancas: [
			{ id: 966, faturaId: 965, valorTotal: 5000, nomeDevedor: "p", documentoDevedor: "1", emailDevedor: "e", status: "erro" as const, dataVencimento: "2026-09-10", notas: [
				{ id: 967, cobrancaId: 966, nome: "n", cpfcnpj: "1", endereco, uf: "PR", cidade: "C", statusInterno: "erro" as const, total: 5000, itens: [] },
			] },
		] });
		const res = await handleEmitFatura(
			{ data: { faturaId: 965 }, attemptsMade: 0, opts: {} } as any,
			{ db, atacado: { getFaturaPorId: mock(() => Promise.resolve(fatura)) } as unknown as AtacadoPort, asaas: {} as any, nfcom: {} as any, enqueueFilho: async () => {} },
		);
		expect(res.enfileiradas).toBe(0);
		const { drainOutbox } = await import("#/lib/db/outbox");
		const msgs = await drainOutbox(db, 20);
		expect(msgs.some((m) => (m.payload as any).op === "atualizarStatusFatura" && (m.payload as any).status === "erro")).toBe(true);
	});
});

// ============================================================
// A1: decisão 1ª vs 2ª passada por nº de children (não só values)
// ============================================================

describe("A1 — decidirPassadaEmissao (4 células p/ emit-fatura e emit-cobranca)", () => {
	// Os dois jobs (EMIT_FATURA/EMIT_COBRANCA) passam pelo MESMO gate no dispatch;
	// a diferença (consolidarFaturaOuCobranca vs consolidarCobranca) acontece no
	// ramo de retorno — aqui cobrimos o gate e cada ramo nos testes abaixo.
	for (const rotulo of ["emit-fatura", "emit-cobranca"]) {
		test(`${rotulo}: sem children registrados → primeira (fan-out)`, async () => {
			// stub SEM getDependencies (job novo: BullMQ ainda não registrou children)
			expect(await decidirPassadaEmissao({ data: {}, attemptsMade: 0, opts: {} } as any, undefined)).toBe("primeira");
			// e com getDependencies de um job que ainda não tem dependências
			const job = {
				data: {}, attemptsMade: 0, opts: {},
				getDependencies: async () => ({ processed: {}, unprocessed: [], failed: [] }),
			} as any;
			expect(await decidirPassadaEmissao(job, undefined)).toBe("primeira");
		});

		test(`${rotulo}: children + values visíveis → segunda (consolida)`, async () => {
			const job = {
				data: {}, attemptsMade: 1, opts: {},
				getDependencies: async () => ({
					processed: { "q:emit-cobranca:1": { boletoOk: true, notasOk: [true] } },
					unprocessed: [], failed: [],
				}),
			} as any;
			expect(await decidirPassadaEmissao(job, { "q:emit-cobranca:1": { boletoOk: true, notasOk: [true] } })).toBe("segunda");
		});

		test(`${rotulo}: children + values ausentes + child ativo → aguardar (retry)`, async () => {
			const job = {
				data: {}, attemptsMade: 1, opts: {},
				getDependencies: async () => ({
					processed: {}, unprocessed: ["q:emit-cobranca:1"], failed: [],
				}),
			} as any;
			// "aguardar" → o dispatch estaciona (WaitingChildrenError) em vez de retornar
			expect(await decidirPassadaEmissao(job, undefined)).toBe("aguardar");
		});

		test(`${rotulo}: children + values ausentes + todos failed → exaustas (estado real)`, async () => {
			const job = {
				data: {}, attemptsMade: 1, opts: {},
				getDependencies: async () => ({
					processed: {}, unprocessed: [], failed: ["q:emit-cobranca:1", "q:emit-cobranca:2"],
				}),
			} as any;
			expect(await decidirPassadaEmissao(job, undefined)).toBe("exaustas");
		});
	}
});

describe("A1 — dispatch processarJobEmissao (4 células reais, sem Redis)", () => {
	/** Monta um WorkerCtx stub com getDependencies + getChildrenValues configuráveis. */
	const ctx = (
		jobName: string,
		job: Record<string, unknown>,
		getChildrenValues: WorkerCtx["getChildrenValues"],
		enfileiradas: { nomes: string[] },
	): WorkerCtx => ({
		jobName,
		jobId: "job-1",
		job: job as WorkerCtx["job"],
		getChildrenValues,
		enqueueFilho: async (name) => { enfileiradas.nomes.push(name); },
		token: "tok",
	});

	// ---------------- emit-fatura ----------------
	test("emit-fatura: sem children → fan-out (handleEmitFatura)", async () => {
		const db = await mkDb();
		const fatura = faturaFixture({ id: 1000, cobrancas: [
			{ id: 1001, faturaId: 1000, valorTotal: 10000, nomeDevedor: "p", documentoDevedor: "1", emailDevedor: "e", status: "a-emitir" as const, dataVencimento: "2026-09-10", notas: [] },
		] });
		const enq = { nomes: [] as string[] };
		const deps = { db, atacado: { getFaturaPorId: mock(() => Promise.resolve(fatura)) } as unknown as AtacadoPort, asaas: {} as any, nfcom: {} as any };
		// moveToWaitingChildren=false: estaciona não pendura (children já prontos
		// no teste) — retorna normalmente com {enfileiradas}.
		const c = ctx("emit-fatura", { data: { faturaId: 1000 }, attemptsMade: 0, opts: {}, moveToWaitingChildren: async () => false }, async () => ({}), enq);
		const res = await processarJobEmissao(c, deps);
		expect((res as any).enfileiradas).toBe(1);
		expect(enq.nomes).toContain("emit-cobranca");
	});

	test("emit-fatura: fan-out + moveToWaitingChildren=true → WaitingChildrenError (estaciona após enfileirar)", async () => {
		const db = await mkDb();
		const fatura = faturaFixture({ id: 1050, cobrancas: [
			{ id: 1051, faturaId: 1050, valorTotal: 10000, nomeDevedor: "p", documentoDevedor: "1", emailDevedor: "e", status: "a-emitir" as const, dataVencimento: "2026-09-10", notas: [] },
		] });
		const enq = { nomes: [] as string[] };
		const deps = { db, atacado: { getFaturaPorId: mock(() => Promise.resolve(fatura)) } as unknown as AtacadoPort, asaas: {} as any, nfcom: {} as any };
		// moveToWaitingChildren=true: havia children pendentes → estaciona.
		const c = ctx("emit-fatura", { data: { faturaId: 1050 }, attemptsMade: 0, opts: {}, moveToWaitingChildren: async () => true }, async () => ({}), enq);
		let threw: unknown = null;
		try {
			await processarJobEmissao(c, deps);
		} catch (e) { threw = e; }
		// Fan-out enfileirou a cobrança antes de estacionar.
		expect(enq.nomes).toContain("emit-cobranca");
		expect(threw).toBeInstanceOf(WaitingChildrenError);
	});

	test("emit-fatura: fan-out sem moveToWaitingChildren → WaitingChildrenError (fallback do stub)", async () => {
		const db = await mkDb();
		const fatura = faturaFixture({ id: 1052, cobrancas: [
			{ id: 1053, faturaId: 1052, valorTotal: 10000, nomeDevedor: "p", documentoDevedor: "1", emailDevedor: "e", status: "a-emitir" as const, dataVencimento: "2026-09-10", notas: [] },
		] });
		const enq = { nomes: [] as string[] };
		const deps = { db, atacado: { getFaturaPorId: mock(() => Promise.resolve(fatura)) } as unknown as AtacadoPort, asaas: {} as any, nfcom: {} as any };
		// Sem moveToWaitingChildren (job real não injetado no stub) → fallback estaciona.
		const c = ctx("emit-fatura", { data: { faturaId: 1052 }, attemptsMade: 0, opts: {} }, async () => ({}), enq);
		let threw: unknown = null;
		try {
			await processarJobEmissao(c, deps);
		} catch (e) { threw = e; }
		expect(enq.nomes).toContain("emit-cobranca");
		expect(threw).toBeInstanceOf(WaitingChildrenError);
	});

	test("emit-fatura: children + values → consolida (consolidarFaturaOuCobranca)", async () => {
		const db = await mkDb();
		const values = { "c1": { boletoOk: true, notasOk: [true] } };
		const c = ctx("emit-fatura", {
			data: { faturaId: 1002 }, attemptsMade: 1, opts: {},
			getDependencies: async () => ({ processed: { c1: values.c1 }, unprocessed: [], failed: [] }),
		}, async () => values as any, { nomes: [] });
		const res = await processarJobEmissao(c, { db, atacado: {} as unknown as AtacadoPort, asaas: {} as any, nfcom: {} as any } as any);
		expect((res as any).status).toBe("emitida");
	});

	test("emit-fatura: children + values ausentes + child ativo → WaitingChildrenError (estaciona, sem custo de attempt)", async () => {
		const db = await mkDb();
		const c = ctx("emit-fatura", {
			data: { faturaId: 1003 }, attemptsMade: 1, opts: {},
			getDependencies: async () => ({ processed: {}, unprocessed: ["c1"], failed: [] }),
		}, async () => ({}), { nomes: [] });
		let threw: unknown = null;
		try {
			await processarJobEmissao(c, { db, atacado: {} as unknown as AtacadoPort, asaas: {} as any, nfcom: {} as any } as any);
		} catch (e) { threw = e; }
		// Sem moveToWaitingChildren no stub → fallback estaciona (WaitingChildrenError).
		expect(threw).toBeInstanceOf(WaitingChildrenError);
	});

	test("emit-fatura: children + values ausentes + moveToWaitingChildren=false → estado real (A2)", async () => {
		const db = await mkDb();
		const endereco = { logradouro: "R", numero: "1", bairro: "B", cep: "8", cidade: "C", uf: "PR" };
		const fatura = faturaFixture({ id: 1090, cobrancas: [
			{ id: 1091, faturaId: 1090, valorTotal: 5000, nomeDevedor: "p", documentoDevedor: "1", emailDevedor: "e", status: "emitida" as const, dataVencimento: "2026-09-10", notas: [
				{ id: 1092, cobrancaId: 1091, nome: "n", cpfcnpj: "1", endereco, uf: "PR", cidade: "C", statusInterno: "emitida" as const, total: 5000, itens: [] },
			] },
		] });
		const c = ctx("emit-fatura", {
			data: { faturaId: 1090 }, attemptsMade: 1, opts: {},
			getDependencies: async () => ({ processed: {}, unprocessed: ["c1"], failed: [] }),
			moveToWaitingChildren: async () => false,
		}, async () => ({}), { nomes: [] });
		// moveToWaitingChildren=false → todos terminaram, values não visíveis → A2.
		const res = await processarJobEmissao(c, { db, atacado: { getFaturaPorId: mock(() => Promise.resolve(fatura)) } as unknown as AtacadoPort, asaas: {} as any, nfcom: {} as any } as any);
		expect((res as any).status).toBe("emitida");
	});

	test("emit-fatura: children + values ausentes + todos failed → estado real", async () => {
		const db = await mkDb();
		const endereco = { logradouro: "R", numero: "1", bairro: "B", cep: "8", cidade: "C", uf: "PR" };
		const fatura = faturaFixture({ id: 1004, cobrancas: [
			{ id: 1005, faturaId: 1004, valorTotal: 5000, nomeDevedor: "p", documentoDevedor: "1", emailDevedor: "e", status: "emitida" as const, dataVencimento: "2026-09-10", notas: [
				{ id: 1006, cobrancaId: 1005, nome: "n", cpfcnpj: "1", endereco, uf: "PR", cidade: "C", statusInterno: "emitida" as const, total: 5000, itens: [] },
			] },
			{ id: 1007, faturaId: 1004, valorTotal: 5000, nomeDevedor: "p", documentoDevedor: "1", emailDevedor: "e", status: "erro" as const, dataVencimento: "2026-09-10", notas: [
				{ id: 1008, cobrancaId: 1007, nome: "n", cpfcnpj: "1", endereco, uf: "PR", cidade: "C", statusInterno: "erro" as const, total: 5000, itens: [] },
			] },
		] });
		const c = ctx("emit-fatura", {
			data: { faturaId: 1004 }, attemptsMade: 4, opts: { attempts: 5 },
			getDependencies: async () => ({ processed: {}, unprocessed: [], failed: ["c1", "c2"] }),
		}, async () => ({}), { nomes: [] });
		const res = await processarJobEmissao(c, { db, atacado: { getFaturaPorId: mock(() => Promise.resolve(fatura)) } as unknown as AtacadoPort, asaas: {} as any, nfcom: {} as any } as any);
		expect((res as any).status).toBe("parcial");
	});

	// ---------------- emit-cobranca ----------------
	test("emit-cobranca: sem children → fan-out (handleEmitCobranca)", async () => {
		const db = await mkDb();
		const c = ctx("emit-cobranca", {
			data: { cobrancaId: 1010, faturaId: 1009, valorTotal: 100, documentoDevedor: "1", nomeDevedor: "n", emailDevedor: "e", dataVencimento: "2026-09-10", notas: [
				{ notaId: 1011, cpfcnpj: "1", nome: "x", uf: "PR", cidade: "C", logradouro: "R", numero: "1", bairro: "B", cep: "8", total: 100, itens: [] },
			] },
			attemptsMade: 0, opts: {},
			moveToWaitingChildren: async () => false,
		}, async () => ({}), { nomes: [] });
		// asaas fake: resolve a key p/ não tentar criar boleto real
		const { acquireKey, resolveKey } = await import("#/lib/db/idempotency");
		await acquireKey(db, "cobranca:1010:boleto", "asaas");
		await resolveKey(db, "cobranca:1010:boleto", "bol");
		const deps = { db, atacado: {} as unknown as AtacadoPort, asaas: { consultarBoletoPorExternalReference: async () => ({ idExterno: "bol", linkFatura: "l" }) }, nfcom: {} as any } as any;
		const res = await processarJobEmissao(c, deps);
		expect((res as any).notasEnfileiradas).toBe(1);
	});

	test("emit-cobranca: children + values → consolida (consolidarCobranca)", async () => {
		const db = await mkDb();
		const { acquireKey, resolveKey } = await import("#/lib/db/idempotency");
		await acquireKey(db, "cobranca:1012:boleto", "asaas");
		await resolveKey(db, "cobranca:1012:boleto", "bol");
		const values = { "n1": { notaOk: true }, "n2": { notaOk: false } };
		const c = ctx("emit-cobranca", {
			data: { cobrancaId: 1012, faturaId: 1009 }, attemptsMade: 1, opts: {},
			getDependencies: async () => ({ processed: { n1: values.n1, n2: values.n2 }, unprocessed: [], failed: [] }),
		}, async () => values as any, { nomes: [] });
		const res = await processarJobEmissao(c, { db, atacado: {} as unknown as AtacadoPort, asaas: {} as any, nfcom: {} as any } as any);
		expect(res).toEqual({ boletoOk: true, notasOk: [true, false], erro: undefined });
	});

	test("emit-cobranca: children + values ausentes + child ativo → WaitingChildrenError (estaciona, sem custo de attempt)", async () => {
		const db = await mkDb();
		const c = ctx("emit-cobranca", {
			data: { cobrancaId: 1013, faturaId: 1009 }, attemptsMade: 1, opts: {},
			getDependencies: async () => ({ processed: {}, unprocessed: ["n1"], failed: [] }),
		}, async () => ({}), { nomes: [] });
		let threw: unknown = null;
		try {
			await processarJobEmissao(c, { db, atacado: {} as unknown as AtacadoPort, asaas: {} as any, nfcom: {} as any } as any);
		} catch (e) { threw = e; }
		// Sem moveToWaitingChildren no stub → fallback estaciona (WaitingChildrenError).
		expect(threw).toBeInstanceOf(WaitingChildrenError);
	});

	test("emit-cobranca: children + values ausentes + todos failed → estado real", async () => {
		const db = await mkDb();
		const { acquireKey, resolveKey } = await import("#/lib/db/idempotency");
		await acquireKey(db, "cobranca:1014:boleto", "asaas");
		await resolveKey(db, "cobranca:1014:boleto", "bol");
		const endereco = { logradouro: "R", numero: "1", bairro: "B", cep: "8", cidade: "C", uf: "PR" };
		const fatura = faturaFixture({ id: 1015, cobrancas: [
			{ id: 1014, faturaId: 1015, valorTotal: 100, nomeDevedor: "p", documentoDevedor: "1", emailDevedor: "e", status: "emitida" as const, dataVencimento: "2026-09-10", notas: [
				{ id: 1016, cobrancaId: 1014, nome: "n", cpfcnpj: "1", endereco, uf: "PR", cidade: "C", statusInterno: "emitida" as const, total: 100, itens: [] },
			] },
		] });
		const c = ctx("emit-cobranca", {
			data: { cobrancaId: 1014, faturaId: 1015 }, attemptsMade: 4, opts: { attempts: 5 },
			getDependencies: async () => ({ processed: {}, unprocessed: [], failed: ["n1"] }),
		}, async () => ({}), { nomes: [] });
		const res = await processarJobEmissao(c, { db, atacado: { getFaturaPorId: mock(() => Promise.resolve(fatura)) } as unknown as AtacadoPort, asaas: {} as any, nfcom: {} as any } as any);
		expect(res).toEqual({ boletoOk: true, notasOk: [true], erro: undefined });
	});
});

// ============================================================
// A2: consolidação tolerante a child falho (fallback pelo estado real)
// ============================================================

describe("A2 — fallback pelo estado real (children exaustos sem values)", () => {
	test("consolidarFaturaPorEstado: mix emitida/erro → parcial + outbox + webhook + releaseLease", async () => {
		const db = await mkDb();
		const { acquireLease } = await import("#/lib/db/lease");
		await acquireLease(db, 970); // o parent detém o lease da 1ª passada
		const { queue, eventos } = fakeQueue();
		const endereco = { logradouro: "R", numero: "1", bairro: "B", cep: "8", cidade: "C", uf: "PR" };
		const fatura = faturaFixture({ id: 970, cobrancas: [
			{ id: 971, faturaId: 970, valorTotal: 5000, nomeDevedor: "p", documentoDevedor: "1", emailDevedor: "e", status: "emitida" as const, dataVencimento: "2026-09-10", notas: [
				{ id: 972, cobrancaId: 971, nome: "n", cpfcnpj: "1", endereco, uf: "PR", cidade: "C", statusInterno: "emitida" as const, total: 5000, itens: [] },
			] },
			{ id: 973, faturaId: 970, valorTotal: 5000, nomeDevedor: "p", documentoDevedor: "1", emailDevedor: "e", status: "erro" as const, dataVencimento: "2026-09-10", notas: [
				{ id: 974, cobrancaId: 973, nome: "n", cpfcnpj: "1", endereco, uf: "PR", cidade: "C", statusInterno: "erro" as const, total: 5000, itens: [] },
			] },
		] });
		const res = await consolidarFaturaPorEstado(
			{ data: { faturaId: 970 }, attemptsMade: 4, opts: { attempts: 5 } } as any,
			{ db, atacado: { getFaturaPorId: mock(() => Promise.resolve(fatura)) } as unknown as AtacadoPort, asaas: {} as any, nfcom: {} as any, queue },
		);
		expect(res.status).toBe("parcial");
		const { drainOutbox } = await import("#/lib/db/outbox");
		const msgs = await drainOutbox(db, 20);
		expect(msgs.some((m) => (m.payload as any).op === "atualizarStatusFatura" && (m.payload as any).status === "parcial")).toBe(true);
		expect(eventos.some((e) => e.tipo === "fatura.status" && e.estado === "parcial")).toBe(true);
		const { hasLease } = await import("#/lib/db/lease");
		expect(await hasLease(db, 970)).toBe(false); // lease liberado (sem órfã)
	});

	test("consolidarFaturaPorEstado: fatura ausente → remenda a-emitir (defesa do lease)", async () => {
		const db = await mkDb();
		await import("#/lib/db/lease").then(({ acquireLease }) => acquireLease(db, 980));
		const res = await consolidarFaturaPorEstado(
			{ data: { faturaId: 980 }, attemptsMade: 4, opts: { attempts: 5 } } as any,
			{ db, atacado: { getFaturaPorId: mock(() => Promise.resolve(null)) } as unknown as AtacadoPort, asaas: {} as any, nfcom: {} as any },
		);
		expect(res.status).toBe("a-emitir");
		const { drainOutbox } = await import("#/lib/db/outbox");
		const msgs = await drainOutbox(db, 20);
		expect(msgs.some((m) => (m.payload as any).op === "atualizarStatusFatura" && (m.payload as any).status === "a-emitir")).toBe(true);
		const { hasLease } = await import("#/lib/db/lease");
		expect(await hasLease(db, 980)).toBe(false);
	});

	test("consolidarCobrancaPorEstado: boleto resolved + notas emitida/erro → ResultadoEmitCobranca real", async () => {
		const db = await mkDb();
		const { acquireKey, resolveKey } = await import("#/lib/db/idempotency");
		await acquireKey(db, "cobranca:991:boleto", "asaas");
		await resolveKey(db, "cobranca:991:boleto", "bol_1");
		const endereco = { logradouro: "R", numero: "1", bairro: "B", cep: "8", cidade: "C", uf: "PR" };
		const fatura = faturaFixture({ id: 990, cobrancas: [
			{ id: 991, faturaId: 990, valorTotal: 5000, nomeDevedor: "p", documentoDevedor: "1", emailDevedor: "e", status: "emitida" as const, dataVencimento: "2026-09-10", notas: [
				{ id: 992, cobrancaId: 991, nome: "n", cpfcnpj: "1", endereco, uf: "PR", cidade: "C", statusInterno: "emitida" as const, total: 3000, itens: [] },
				{ id: 993, cobrancaId: 991, nome: "n", cpfcnpj: "1", endereco, uf: "PR", cidade: "C", statusInterno: "erro" as const, total: 2000, itens: [] },
			] },
		] });
		const res = await consolidarCobrancaPorEstado(
			{ data: { cobrancaId: 991, faturaId: 990 }, attemptsMade: 4, opts: { attempts: 5 } } as any,
			{ db, atacado: { getFaturaPorId: mock(() => Promise.resolve(fatura)) } as unknown as AtacadoPort, asaas: {} as any, nfcom: {} as any },
		);
		expect(res).toEqual({ boletoOk: true, notasOk: [true, false], erro: undefined });
	});

	test("consolidarCobrancaPorEstado: boleto sem key + cobrança ausente → boletoOk false, notasOk vazio", async () => {
		const db = await mkDb();
		const res = await consolidarCobrancaPorEstado(
			{ data: { cobrancaId: 995, faturaId: 994 }, attemptsMade: 4, opts: { attempts: 5 } } as any,
			{ db, atacado: { getFaturaPorId: mock(() => Promise.resolve(null)) } as unknown as AtacadoPort, asaas: {} as any, nfcom: {} as any },
		);
		expect(res).toEqual({ boletoOk: false, notasOk: [], erro: "boleto não emitido" });
	});
});

// ============================================================
// A4: defesa no "pulando" do lease em re-entrada
// ============================================================

describe("A4 — lease de outrem: re-entrada lança, 1ª entrada pula", () => {
	const depsBase = (db: Awaited<ReturnType<typeof mkDb>>) => ({
		db,
		atacado: { getFaturaPorId: mock(() => Promise.resolve(null)) } as unknown as AtacadoPort,
		asaas: {} as any,
		nfcom: {} as any,
		enqueueFilho: async () => {},
	});

	test("attemptsMade > 0 + lease de outrem → ErroRetryable (defesa do Defeito A)", async () => {
		const db = await mkDb();
		const { acquireLease } = await import("#/lib/db/lease");
		await acquireLease(db, 996); // outro job detém
		let threw: unknown = null;
		try {
			await handleEmitFatura(
				{ data: { faturaId: 996 }, attemptsMade: 2, opts: { attempts: 5 } } as any,
				depsBase(db),
			);
		} catch (e) {
			threw = e;
		}
		expect(threw).toBeInstanceOf(ErroRetryable);
	});

	test("attemptsMade === 0 + lease de outrem → pula (duplo /emitir legítimo)", async () => {
		const db = await mkDb();
		const { acquireLease } = await import("#/lib/db/lease");
		await acquireLease(db, 997);
		const enqueued: string[] = [];
		const res = await handleEmitFatura(
			{ data: { faturaId: 997 }, attemptsMade: 0, opts: {} } as any,
			{ ...depsBase(db), enqueueFilho: async (n: string) => { enqueued.push(n); } },
		);
		expect(res.enfileiradas).toBe(0);
		expect(enqueued.length).toBe(0);
	});
});

describe("B — numeroDaChave (nNF da chave de acesso)", () => {
	test("chave de 44 díg. → nº na posição 26-34", () => {
		// nNF = 129 (dígitos 26-34).
		expect(numeroDaChave("42260819782703000147620010000001291000000012")).toBe(129);
	});

	test("chave com nNF 122 → 122", () => {
		expect(numeroDaChave("42260819782703000147620010000001221000000012")).toBe(122);
	});

	test("chave ausente → undefined", () => {
		expect(numeroDaChave(undefined)).toBeUndefined();
		expect(numeroDaChave("")).toBeUndefined();
	});

	test("chave malformada (<44 díg.) → undefined", () => {
		expect(numeroDaChave("4226")).toBeUndefined();
	});

	test("nNF zerado → undefined (não assume 0)", () => {
		expect(numeroDaChave("42260819782703000147620010000000001000000012")).toBeUndefined();
	});
});

describe("B — reconciliação de duplicidade grava numero da chave", () => {
	test("emitirNFCom lança Duplicidade + inspeção achou → outbox atualizarStatusNota com numero derivado da chave", async () => {
		const db = await mkDb();
		const { queue } = fakeQueue();
		// Chave com nNF=122; inspeção (/api/lista) devolve só chave/protocolo (sem numero).
		const chave = "42260819782703000147620010000001221000000012";
		const nfcom = {
			emitirNFCom: mock(() => Promise.reject(new Error("Duplicidade de NFCom [nProt: 999]"))),
			consultarLista: mock(() => Promise.resolve([{ chave, situacao: "autorizada", protocolo: "P123" }])),
		} as unknown as NfcomPort;
		const res = await handleEmitNfcom(
			{ data: { notaId: 800, cobrancaId: 801, faturaId: 802, destinatario: { nome: "n", cpfcnpj: "11444777000161", uf: "PR", cidade: "C", logradouro: "R", numero: "1", bairro: "B", cep: "8" }, itens: [], total: 100 } as any, attemptsMade: 0, opts: {} } as any,
			{ db, nfcom, atacado: {} as unknown as AtacadoPort, asaas: {} as any, queue },
		);
		expect(res.notaOk).toBe(true);
		expect(res.statusInterno).toBe("emitida");
		const { drainOutbox } = await import("#/lib/db/outbox");
		const msgs = await drainOutbox(db, 20);
		const atualiza = msgs.find((m) => (m.payload as any).op === "atualizarStatusNota");
		expect(atualiza).toBeTruthy();
		expect((atualiza!.payload as any).numero).toBe(122);
		expect((atualiza!.payload as any).chave).toBe(chave);
		expect((atualiza!.payload as any).protocolo).toBe("P123");
	});

	test("caminho feliz: gateway devolve numero → usa o devolvido (não deriva da chave)", async () => {
		const db = await mkDb();
		const { queue } = fakeQueue();
		const nfcom = {
			emitirNFCom: mock(() => Promise.resolve({ situacao: "autorizada", numero: 321, serie: 1, chave: "42260819782703000147620010000001221000000012", protocolo: "P" })),
		} as unknown as NfcomPort;
		await handleEmitNfcom(
			{ data: { notaId: 810, cobrancaId: 801, faturaId: 802, destinatario: { nome: "n", cpfcnpj: "11444777000161", uf: "PR", cidade: "C", logradouro: "R", numero: "1", bairro: "B", cep: "8" }, itens: [], total: 100 } as any, attemptsMade: 0, opts: {} } as any,
			{ db, nfcom, atacado: {} as unknown as AtacadoPort, asaas: {} as any, queue },
		);
		const { drainOutbox } = await import("#/lib/db/outbox");
		const msgs = await drainOutbox(db, 20);
		const atualiza = msgs.find((m) => (m.payload as any).op === "atualizarStatusNota");
		// numero 321 (do gateway), não 122 (derivado da chave).
		expect((atualiza!.payload as any).numero).toBe(321);
	});
});
