/**
 * Self-test dos fakes/fixturos de test/http/_helpers.ts: cada método dos fakes
 * (arrow functions internas) é exercitado — senão o gate de funções por arquivo
 * (bunfig coverageThreshold) os conta como não cobertos.
 */
import { describe, expect, it } from "bun:test";
import {
	CNPJ_VALIDO,
	CPF_VALIDO,
	parceiroFixture,
	clienteFixture,
	planoFixture,
	fakeAtacado,
	fakeQueue,
	faturaAemitirFixture,
} from "./_helpers";

describe("http/_helpers — fixtures", () => {
	it("parceiroFixture: valores base + override", () => {
		const p = parceiroFixture();
		expect(p.cnpj).toBe(CNPJ_VALIDO);
		expect(p.diaVencimento).toBe(10);
		expect(parceiroFixture({ id: 99 }).id).toBe(99);
	});

	it("clienteFixture: valores base + override", () => {
		const c = clienteFixture();
		expect(c.cpfcnpj).toBe(CPF_VALIDO);
		expect(c.linhas).toHaveLength(1);
		expect(clienteFixture({ id: 7 }).id).toBe(7);
	});

	it("planoFixture: valores base + override", () => {
		const p = planoFixture();
		expect(p.preco).toBe(10000);
		expect(planoFixture({ preco: 1 }).preco).toBe(1);
	});

	it("faturaAemitirFixture: árvore 1 cobrança + 1 nota a-emitir + override", () => {
		const f = faturaAemitirFixture();
		expect(f.status).toBe("a-emitir");
		expect(f.cobrancas).toHaveLength(1);
		expect(f.cobrancas[0].notas).toHaveLength(1);
		expect(faturaAemitirFixture({ status: "emitida" }).status).toBe("emitida");
	});
});

describe("http/_helpers — fakeAtacado (todos os métodos)", () => {
	it("leitura: parceiro/clientes/planos/fatura/erros", async () => {
		const a = fakeAtacado();
		expect((await a.buscarParceiroPorId(1)).id).toBe(42);
		expect((await a.buscarClientesAtivosPorParceiro(1))).toHaveLength(1);
		expect(await a.buscarPlanosDeServico()).toHaveLength(1);
		expect(await a.buscarFaturaPorChave(1, "2026-08-01")).toBeNull();
		expect(await a.getFaturaPorId(1)).toBeNull();
		expect(await a.buscarErrosPorFatura([1], [])).toEqual([]);
	});

	it("escrita: criar árvore, removerArvore e updates resolvem sem erro", async () => {
		const a = fakeAtacado();
		expect(await a.criarFatura({} as never)).toEqual({ id: 101 });
		expect(await a.criarCobranca(1, {} as never)).toEqual({ id: 456 });
		expect(await a.criarNota(1, {} as never)).toEqual({ id: 7 });
		expect(await a.criarItem(1, {} as never)).toBeUndefined();
		await a.removerArvore(1);
		await a.atualizarStatusFatura(1, "emitindo");
		await a.atualizarStatusCobranca(1, "emitida");
		await a.atualizarStatusNota(1, { statusInterno: "emitida" } as never);
		await a.registrarErro({} as never);
	});

	it("override sobrescreve métodos individuais", async () => {
		const a = fakeAtacado({ buscarFaturaPorChave: async () => ({ id: 5, status: "erro" } as never) });
		expect((await a.buscarFaturaPorChave(1, "x")).id).toBe(5);
	});
});

describe("http/_helpers — fakeQueue", () => {
	it("regista chamadas de enfileirarEmissaoFatura e no-op de webhook", async () => {
		const q = fakeQueue();
		expect(await q.enfileirarEmissaoFatura(42)).toEqual({ jobId: "job-1" });
		await q.enfileirarWebhook({} as never);
		expect(q.calls).toEqual([{ faturaId: 42 }]);
	});

	it("override sobrescreve e preserva o registro de calls", async () => {
		const q = fakeQueue({
			enfileirarEmissaoFatura: async (id) => ({ jobId: `j-${id}` }),
		});
		expect(await q.enfileirarEmissaoFatura(7)).toEqual({ jobId: "j-7" });
	});
});
