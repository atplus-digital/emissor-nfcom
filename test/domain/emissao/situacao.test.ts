import { describe, expect, it } from "bun:test";
import { mapearSituacaoNota } from "#/domain/emissao/situacao";

describe("mapearSituacaoNota (SPEC-0001)", () => {
	it("autorizada → statusInterno=emitida, situacao=autorizada (caso feliz)", () => {
		const r = mapearSituacaoNota("autorizada");
		expect(r.statusInterno).toBe("emitida");
		expect(r.situacao).toBe("autorizada");
	});

	it("processando → statusInterno=a-emitir (aguarda retry) (SPEC-0001 caso 6)", () => {
		const r = mapearSituacaoNota("processando");
		expect(r.statusInterno).toBe("a-emitir");
		expect(r.situacao).toBe("processando");
	});

	it("rejeitada → statusInterno=erro (fatal) (SPEC-0001 caso 7)", () => {
		const r = mapearSituacaoNota("rejeitada");
		expect(r.statusInterno).toBe("erro");
		expect(r.situacao).toBe("rejeitada");
	});

	it("cancelada → statusInterno=erro (fatal, reportada pelo gateway) (SPEC-0001 caso 7)", () => {
		const r = mapearSituacaoNota("cancelada");
		expect(r.statusInterno).toBe("erro");
		expect(r.situacao).toBe("cancelada");
	});

	it("erro local (sem situacao do gateway) → statusInterno=erro, situacao inalterado/undefined", () => {
		const r = mapearSituacaoNota(undefined, true);
		expect(r.statusInterno).toBe("erro");
		// situacao inalterada (não espelha situação inexistente)
		expect(r.situacao).toBeUndefined();
	});

	it("sem situacao e sem erro local → não emite estado (a-emitir, sem situacao)", () => {
		const r = mapearSituacaoNota(undefined);
		expect(r.statusInterno).toBe("a-emitir");
		expect(r.situacao).toBeUndefined();
	});

	it("nunca produz statusInterno=cancelada (reservado à SPEC-0003)", () => {
		// em nenhuma entrada o mapeamento retorna "cancelada"
		const entradas: Parameters<typeof mapearSituacaoNota>[0][] = ["autorizada", "rejeitada", "cancelada", "processando", undefined];
		for (const e of entradas) {
			const r = mapearSituacaoNota(e, e === undefined);
			expect(r.statusInterno).not.toBe("cancelada");
		}
	});
});
