import { describe, expect, it } from "bun:test";
import { consolidarFatura } from "#/domain/emissao/consolidacao";

interface R {
	cobrancaId: number;
	boletoOk: boolean;
	notasOk: boolean[];
}

describe("consolidarFatura (SPEC-0001)", () => {
	it("tudo ok → emitida (caso feliz)", () => {
		const r: R[] = [{ cobrancaId: 1, boletoOk: true, notasOk: [true] }];
		const { status } = consolidarFatura(r);
		expect(status).toBe("emitida");
	});

	it("todos falham → erro (SPEC-0001 caso 10)", () => {
		const r: R[] = [
			{ cobrancaId: 1, boletoOk: false, notasOk: [false] },
			{ cobrancaId: 2, boletoOk: false, notasOk: [false] },
		];
		const { status } = consolidarFatura(r);
		expect(status).toBe("erro");
	});

	it("algum sucesso, algum erro → parcial (SPEC-0001 caso 11)", () => {
		const r: R[] = [
			{ cobrancaId: 1, boletoOk: true, notasOk: [true] },
			{ cobrancaId: 2, boletoOk: false, notasOk: [false] },
		];
		const { status } = consolidarFatura(r);
		expect(status).toBe("parcial");
	});

	it("nota com boleto falho: a nota emite e a fatura é parcial, não erro (SPEC-0001 caso 18)", () => {
		const r: R[] = [
			{ cobrancaId: 1, boletoOk: false, notasOk: [true] }, // boleto falhou, nota ok
		];
		const { status } = consolidarFatura(r);
		expect(status).toBe("parcial");
	});

	it("caso 18: boleto falho mas nota ok não derruba para erro mesmo se for a única cobrança", () => {
		const r: R[] = [{ cobrancaId: 1, boletoOk: false, notasOk: [true, true] }];
		const { status } = consolidarFatura(r);
		// nota emite (obrigação fiscal); boleto falhou → parcial, não erro
		expect(status).toBe("parcial");
	});

	it("todas as notas ok mas todos os boletos falharam → parcial (notas independentes do boleto)", () => {
		const r: R[] = [
			{ cobrancaId: 1, boletoOk: false, notasOk: [true] },
			{ cobrancaId: 2, boletoOk: false, notasOk: [true] },
		];
		const { status } = consolidarFatura(r);
		expect(status).toBe("parcial");
	});

	it("lista vazia → a-emitir (m3: nada foi emitido)", () => {
		const { status } = consolidarFatura([]);
		expect(status).toBe("a-emitir");
	});
});
