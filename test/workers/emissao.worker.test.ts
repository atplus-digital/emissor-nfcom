/** Unit do worker de emissão: wrapper ALS, consolidação. */
import { describe, expect, test } from "bun:test";
import { consolidar } from "#/workers/emissao.worker";
import type { ResultadoCobranca } from "#/domain/emissao/consolidacao";

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
	test("sem cobranças → emitida", () => {
		expect(consolidar([])).toBe("emitida");
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
