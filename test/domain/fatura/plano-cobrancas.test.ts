import { describe, expect, it } from "bun:test";
import { construirPlanoCobrancas } from "#/domain/fatura/plano-cobrancas";
import type { DefaultsFiscais } from "#/domain/fatura/defaults-fiscais";
import type { Cliente, Parceiro } from "#/domain/types";

const parceiro: Parceiro = {
	id: 1, razaoSocial: "Parceiro Ltda", cnpj: "11444777000161",
	emailFaturamento: "fin@p.com", diaVencimento: 10,
	endereco: { logradouro: "R", numero: "1", bairro: "C", cep: "80000000", cidade: "Curitiba", uf: "PR" },
};

function cliente(id: number, nome: string): Cliente {
	return {
		id, nome, cpfcnpj: "52998224725", email: "c@x.com",
		endereco: { logradouro: "R", numero: "1", bairro: "C", cep: "80000000", cidade: "Curitiba", uf: "PR" },
		linhas: [{ planoId: 1, descricao: "Plano A", unitario: 1000, quantidade: 1 }],
	};
}

const clientes = [cliente(10, "João"), cliente(11, "Maria")];

const defaults: DefaultsFiscais = { cfop: "6102", cclass: "C1", aliqIcms: 0 };

describe("construirPlanoCobrancas — cardinalidade por tipoFaturamento", () => {
	it("parceiro: 1 cobrança ao parceiro, 1 nota ao parceiro", () => {
		const c = construirPlanoCobrancas(clientes, parceiro, "parceiro", "2026-09-10", defaults);
		expect(c.length).toBe(1);
		expect(c[0].notas.length).toBe(1);
		expect(c[0].nomeDevedor).toBe(parceiro.razaoSocial);
		expect(c[0].documentoDevedor).toBe(parceiro.cnpj);
		expect(c[0].notas[0].nome).toBe(parceiro.razaoSocial);
	});

	it("via-parceiro: 1 cobrança ao parceiro, N notas (1 por cliente)", () => {
		const c = construirPlanoCobrancas(clientes, parceiro, "via-parceiro", "2026-09-10", defaults);
		expect(c.length).toBe(1);
		expect(c[0].notas.length).toBe(2);
		expect(c[0].nomeDevedor).toBe(parceiro.razaoSocial);
		expect(c[0].notas.map((n) => n.nome).sort()).toEqual(["João", "Maria"]);
	});

	it("cofaturamento: cardinalidade idêntica ao via-parceiro (SPEC-0002 caso 12)", () => {
		const c = construirPlanoCobrancas(clientes, parceiro, "cofaturamento", "2026-09-10", defaults);
		expect(c.length).toBe(1);
		expect(c[0].notas.length).toBe(2);
		expect(c[0].nomeDevedor).toBe(parceiro.razaoSocial);
		// comparar estrutura com via-parceiro (mesma cardinalidade)
		const via = construirPlanoCobrancas(clientes, parceiro, "via-parceiro", "2026-09-10", defaults);
		expect(c.length).toBe(via.length);
		expect(c[0].notas.length).toBe(via[0].notas.length);
	});

	it("cliente-final: N cobranças (1 por cliente), N notas (1 por cliente)", () => {
		const c = construirPlanoCobrancas(clientes, parceiro, "cliente-final", "2026-09-10", defaults);
		expect(c.length).toBe(2);
		expect(c[0].notas.length).toBe(1);
		expect(c[1].notas.length).toBe(1);
		// cada cobrança devedor = o próprio cliente
		expect(c[0].nomeDevedor).toBe("João");
		expect(c[1].nomeDevedor).toBe("Maria");
		expect(c[0].notas[0].nome).toBe("João");
		expect(c[1].notas[0].nome).toBe("Maria");
	});

	it("todas as cobranças têm status a-emitir e a dataVencimento informada", () => {
		const c = construirPlanoCobrancas(clientes, parceiro, "cliente-final", "2026-09-10", defaults);
		for (const cob of c) {
			expect(cob.status).toBe("a-emitir");
			expect(cob.dataVencimento).toBe("2026-09-10", defaults);
			for (const n of cob.notas) {
				expect(n.statusInterno).toBe("a-emitir");
			}
		}
	});
});
