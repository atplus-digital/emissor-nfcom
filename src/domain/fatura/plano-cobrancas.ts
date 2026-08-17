/**
 * Plano de cobranças por `tipoFaturamento` (SPEC-0002 — tabela de cardinalidade):
 *
 * | tipo            | cobranças | notas | devedor        | destinatário da nota     |
 * |-----------------|-----------|-------|----------------|--------------------------|
 * | parceiro        | 1         | 1     | parceiro       | parceiro (tudo agrupado) |
 * | via-parceiro    | 1         | N     | parceiro       | cada cliente             |
 * | cofaturamento   | 1         | N     | parceiro       | cada cliente             |
 * | cliente-final   | N         | N     | cada cliente   | cada cliente             |
 *
 * Caso 12: via-parceiro e cofaturamento têm cardinalidade idêntica hoje (enums
 * distintos podem divergir no futuro).
 */
import type {
	Cobranca,
	Cliente,
	Item,
	Nota,
	Parceiro,
	TipoFaturamento,
} from "#/domain/types";

const FISCAL_DEFAULTS = {
	cfop: "6102",
	cclass: "", // preenchido pelo caller (env FISCAL_CCLASS_DEFAULT) no cálculo
	aliqIcms: 0,
	incideAliquota: false,
};

function itemDeLinha(descricao: string, unitario: number, quantidade: number): Item {
	const total = unitario * quantidade;
	return {
		descricao,
		cfop: FISCAL_DEFAULTS.cfop,
		cclass: FISCAL_DEFAULTS.cclass,
		quantidade,
		unitario,
		total,
		aliqIcms: FISCAL_DEFAULTS.aliqIcms,
		bcIcms: total,
		icms: Math.round(total * FISCAL_DEFAULTS.aliqIcms),
		incideAliquota: FISCAL_DEFAULTS.incideAliquota,
	};
}

function itensDoCliente(c: Cliente): Item[] {
	return c.linhas.map((l) => itemDeLinha(l.descricao, l.unitario, l.quantidade));
}

function totalCliente(c: Cliente): number {
	return c.linhas.reduce((acc, l) => acc + l.unitario * l.quantidade, 0);
}

function notaParaCliente(c: Cliente, cobrancaId: number): Nota {
	return {
		cobrancaId,
		nome: c.nome,
		cpfcnpj: c.cpfcnpj,
		email: c.email,
		endereco: c.endereco,
		rgie: undefined,
		telefone: undefined,
		uf: c.endereco.uf,
		cidade: c.endereco.cidade,
		statusInterno: "a-emitir",
		total: totalCliente(c),
		itens: itensDoCliente(c),
	};
}

function notaParaParceiro(p: Parceiro, cobrancaId: number, clientes: Cliente[]): Nota {
	const itens = clientes.flatMap(itensDoCliente);
	const total = itens.reduce((acc, i) => acc + i.total, 0);
	return {
		cobrancaId,
		nome: p.razaoSocial,
		cpfcnpj: p.cnpj,
		email: p.emailFaturamento,
		endereco: p.endereco,
		rgie: p.ie,
		telefone: undefined,
		uf: p.endereco.uf,
		cidade: p.endereco.cidade,
		statusInterno: "a-emitir",
		total,
		itens,
	};
}

function cobrancaUnicaParceiro(
	p: Parceiro,
	clientes: Cliente[],
	dataVencimento: string,
	notas: Nota[],
): Cobranca {
	const valorTotal = notas.reduce((acc, n) => acc + n.total, 0);
	return {
		faturaId: 0, // preenchido pelo caller ao persistir
		valorTotal,
		nomeDevedor: p.razaoSocial,
		documentoDevedor: p.cnpj,
		emailDevedor: p.emailFaturamento,
		status: "a-emitir",
		dataVencimento,
		notas,
	};
}

/**
 * Constrói o plano de cobranças conforme o `tipoFaturamento`. `faturaId` das
 * cobranças/notas é preenchido pelo caller (camada de persistência) — aqui fica 0.
 */
export function construirPlanoCobrancas(
	clientes: Cliente[],
	parceiro: Parceiro,
	tipoFaturamento: TipoFaturamento,
	dataVencimento: string,
): Cobranca[] {
	switch (tipoFaturamento) {
		case "parceiro":
			return [
				cobrancaUnicaParceiro(
					parceiro,
					clientes,
					dataVencimento,
					[notaParaParceiro(parceiro, 0, clientes)],
				),
			];
		case "via-parceiro":
		case "cofaturamento": {
			const notas = clientes.map((c) => notaParaCliente(c, 0));
			return [cobrancaUnicaParceiro(parceiro, clientes, dataVencimento, notas)];
		}
		case "cliente-final":
			return clientes.map((c) => {
				const nota = notaParaCliente(c, 0);
				return {
					faturaId: 0,
					valorTotal: nota.total,
					nomeDevedor: c.nome,
					documentoDevedor: c.cpfcnpj,
					emailDevedor: c.email ?? "",
					status: "a-emitir",
					dataVencimento,
					notas: [nota],
				};
			});
	}
}
