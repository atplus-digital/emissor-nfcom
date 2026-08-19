/**
 * `montarDescricaoCobranca` / `mesDeDataReferencia` — montagem da `f_descricao`
 * a partir do domínio (movidos do translator do Atacado; ADR-0004/0007).
 */
import { describe, expect, it } from "bun:test";
import { mesDeDataReferencia, montarDescricaoCobranca } from "#/domain/fatura/descricao";
import type { Item } from "#/domain/types";

describe("domain/fatura/descricao", () => {
	it("montarDescricaoCobranca lista itens com quantidade/total + referência de mês", () => {
		const itens: Item[] = [
			{ quantidade: 2, descricao: "Voz Empresarial", total: 9990 },
			{ quantidade: 1, descricao: "Internet Dedicada", total: 19990 },
		];
		expect(montarDescricaoCobranca(itens, "2026-08-01")).toBe(
			"2x Voz Empresarial = R$ 99,90\n1x Internet Dedicada = R$ 199,90\nAgo/2026",
		);
	});

	it("montarDescricaoCobranca agrega itens de todas as notas da cobrança", () => {
		const itensNota1: Item[] = [{ quantidade: 1, descricao: "A", total: 1000 }];
		const itensNota2: Item[] = [{ quantidade: 3, descricao: "B", total: 3000 }];
		const descricao = montarDescricaoCobranca(
			[...itensNota1, ...itensNota2],
			"2026-12-01",
		);
		expect(descricao).toBe("1x A = R$ 10,00\n3x B = R$ 30,00\nDez/2026");
	});

	it("mesDeDataReferencia formata YYYY-MM → abreviação pt-BR do mês", () => {
		expect(mesDeDataReferencia("2026-01-01")).toBe("Jan/2026");
		expect(mesDeDataReferencia("2026-08-01")).toBe("Ago/2026");
		expect(mesDeDataReferencia("2026-12-01")).toBe("Dez/2026");
	});

	it("mesDeDataReferencia lança para data inválida", () => {
		expect(() => mesDeDataReferencia("invalida")).toThrow();
	});
});
