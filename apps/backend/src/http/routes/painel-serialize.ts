/**
 * Serialização de UI do painel (domínio → JSON de exibição).
 *
 * Fronteira de exibição: a única camada onde **centavos → reais** acontecem
 * (ADR-0004 — o domínio fica em centavos inteiros; a conversão `cents/100`
 * vive SÓ aqui) e onde o documento **limpo → mascarado** (CPF
 * `000.000.000-00`, CNPJ `00.000.000/0000-00`). Status seguem os enums do
 * domínio (o front resolve a cor/ícone).
 */
import type { Cliente, Endereco, Fatura, Parceiro } from "#/domain/types";
import type {
	ErroEmissao,
	FaturaResumo,
	ParceiroResumo,
} from "#/domain/ports/atacado.port";
import { serializarEmissao, type EmissaoResponse } from "./faturas.route";

/** Documento limpo → mascarado (CPF 11 dígitos; CNPJ 14; demais → não altera). */
export function mascararDoc(doc: string): string {
	const d = doc.replace(/\D/g, "");
	if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
	if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
	return doc;
}

/** Resumo de fatura p/ a listagem (valores em reais, 2 casas). */
export interface FaturaListaItem {
	id: number;
	parceiroId: number;
	dataReferencia: string;
	dataVencimento: string;
	/** Total em reais (centavos/100 — fronteira de UI, ADR-0004). */
	valorTotal: number;
	tipoFaturamento: string;
	status: string;
	cobrancasCount: number;
}

/** Detalhe de fatura (árvore completa, valores em reais, documentos mascarados). */
export interface FaturaDetalheItem {
	id?: number;
	parceiroId: number;
	dataReferencia: string;
	dataVencimento: string;
	valorTotal: number;
	tipoFaturamento: string;
	status: string;
	cobrancas: {
		id?: number;
		valorTotal: number;
		nomeDevedor: string;
		documentoDevedor: string;
		emailDevedor: string;
		status: string;
		linkFatura?: string;
		dataVencimento: string;
		notas: {
			id?: number;
			nome: string;
			cpfcnpj: string;
			email?: string;
			statusInterno: string;
			situacao?: string;
			numero?: number;
			chave?: string;
			pdfUrl?: string;
			total: number;
		}[];
	}[];
}

/**
 * Lista de resumos de fatura (GET /painel/faturas). `resumos` já vêm em
 * centavos (domínio) — a conversão p/ reais é aqui.
 */
export function serializarFaturaLista(resumos: FaturaResumo[]): FaturaListaItem[] {
	return resumos.map((r) => ({
		id: r.id,
		parceiroId: r.parceiroId,
		dataReferencia: r.dataReferencia,
		dataVencimento: r.dataVencimento,
		valorTotal: r.valorTotal / 100,
		tipoFaturamento: r.tipoFaturamento,
		status: r.status,
		cobrancasCount: r.cobrancasCount,
	}));
}

/** Detalhe de fatura (GET /painel/faturas/:id). */
export function serializarFaturaDetalhe(fatura: Fatura): FaturaDetalheItem {
	return {
		id: fatura.id,
		parceiroId: fatura.parceiroId,
		dataReferencia: fatura.dataReferencia,
		dataVencimento: fatura.dataVencimento,
		valorTotal: fatura.valorTotal / 100,
		tipoFaturamento: fatura.tipoFaturamento,
		status: fatura.status,
		cobrancas: fatura.cobrancas.map((cb) => ({
			id: cb.id,
			valorTotal: cb.valorTotal / 100,
			nomeDevedor: cb.nomeDevedor,
			documentoDevedor: mascararDoc(cb.documentoDevedor),
			emailDevedor: cb.emailDevedor,
			status: cb.status,
			linkFatura: cb.linkFatura,
			dataVencimento: cb.dataVencimento,
			notas: cb.notas.map((n) => ({
				id: n.id,
				nome: n.nome,
				cpfcnpj: mascararDoc(n.cpfcnpj),
				email: n.email,
				statusInterno: n.statusInterno,
				situacao: n.situacao,
				numero: n.numero,
				chave: n.chave,
				pdfUrl: n.pdfUrl,
				total: n.total / 100,
			})),
		})),
	};
}

/**
 * Estado de emissão do painel (GET /painel/faturas/:id/emissao) — mesma
 * serialização da rota de emissão (`serializarEmissao`), exportada de
 * `faturas.route.ts` p/ reuso (sem duplicar a lógica).
 */
export function serializarEmissaoPainel(fatura: Fatura, erros: ErroEmissao[]): EmissaoResponse {
	return serializarEmissao(fatura, erros);
}

/** Item de parceiro p/ a listagem (CNPJ mascarado — fronteira de UI). */
export interface ParceiroListaItem {
	id: number;
	razaoSocial: string;
	fantasia?: string;
	cnpj: string;
}

/** Detalhe de parceiro (endereço completo, CNPJ mascarado). */
export interface ParceiroDetalheItem {
	id: number;
	razaoSocial: string;
	fantasia?: string;
	cnpj: string;
	emailFaturamento: string;
	diaVencimento: number;
	ie?: string;
	endereco: Endereco;
}

/** Item de cliente p/ listagem (linhas com unitário em reais). */
export interface ClienteListaItem {
	id: number;
	nome: string;
	fantasia?: string;
	cpfcnpj: string;
	email?: string;
	endereco: Endereco;
	linhas: {
		planoId: number;
		descricao: string;
		/** Unitário em reais (centavos/100 — fronteira de UI, ADR-0004). */
		unitario: number;
		quantidade: number;
	}[];
}

/**
 * Lista de parceiros (GET /painel/api/parceiros). `resumos` já vêm com CNPJ
 * limpo (domínio) — a máscara é aqui (fronteira de UI).
 */
export function serializarParceiroLista(resumos: ParceiroResumo[]): ParceiroListaItem[] {
	return resumos.map((r) => ({
		id: r.id,
		razaoSocial: r.razaoSocial,
		fantasia: r.fantasia,
		cnpj: mascararDoc(r.cnpj),
	}));
}

/** Detalhe de parceiro (GET /painel/api/parceiros/:id). */
export function serializarParceiroDetalhe(p: Parceiro): ParceiroDetalheItem {
	return {
		id: p.id,
		razaoSocial: p.razaoSocial,
		fantasia: p.fantasia,
		cnpj: mascararDoc(p.cnpj),
		emailFaturamento: p.emailFaturamento,
		diaVencimento: p.diaVencimento,
		ie: p.ie,
		endereco: p.endereco,
	};
}

/** Lista de clientes ativos (GET /painel/api/parceiros/:id/clientes). */
export function serializarClienteLista(clientes: Cliente[]): ClienteListaItem[] {
	return clientes.map((c) => ({
		id: c.id,
		nome: c.nome,
		fantasia: c.fantasia,
		cpfcnpj: mascararDoc(c.cpfcnpj),
		email: c.email,
		endereco: c.endereco,
		linhas: c.linhas.map((l) => ({
			planoId: l.planoId,
			descricao: l.descricao,
			unitario: l.unitario / 100,
			quantidade: l.quantidade,
		})),
	}));
}

/** Item da forma bruta do preparo (centavos inteiros — domínio). */
interface PreparoCruItem {
	item?: number;
	codigo?: string;
	descricao: string;
	cfop: string;
	cclass: string;
	quantidade: number;
	/** Centavos (domínio). */
	unitario: number;
	/** Centavos (domínio). */
	total: number;
	/** Alíquota de ICMS (fração 0..1). */
	aliqIcms: number;
	/** Centavos (domínio). */
	bcIcms: number;
	/** Centavos (domínio). */
	icms: number;
	incideAliquota: boolean;
}

/**
 * Forma bruta da resposta do handler de preparo (`serializarFatura` de
 * `preparar.handler.ts`) — centavos inteiros + documentos limpos (domínio).
 */
export interface PreparoCru {
	faturaId: number;
	status: string;
	dataReferencia: string;
	dataVencimento: string;
	/** Centavos (domínio). */
	valorTotal: number;
	tipoFaturamento: string;
	cobrancas: {
		id: number;
		/** Centavos (domínio). */
		valorTotal: number;
		nomeDevedor: string;
		/** Documento limpo (domínio). */
		documentoDevedor: string;
		emailDevedor: string;
		status: string;
		dataVencimento: string;
		/** Descrição exibida no boleto (f_descricao). */
		descricao: string;
		notas: {
			id: number;
			nome: string;
			/** Documento limpo (domínio). */
			cpfcnpj: string;
			email?: string;
			telefone?: string;
			endereco: Endereco;
			/** Centavos (domínio). */
			total: number;
			cobrancaId: number;
			status: string;
			itens: PreparoCruItem[];
		}[];
	}[];
}

/** Item do preparo p/ o painel (valores em reais — fronteira de UI). */
interface PreparoItemItem {
	item?: number;
	codigo?: string;
	descricao: string;
	cfop: string;
	cclass: string;
	quantidade: number;
	/** Reais (centavos/100 — fronteira de UI, ADR-0004). */
	unitario: number;
	/** Reais (centavos/100 — fronteira de UI, ADR-0004). */
	total: number;
	/** Alíquota de ICMS (fração 0..1). */
	aliqIcms: number;
	/** Reais (centavos/100 — fronteira de UI, ADR-0004). */
	bcIcms: number;
	/** Reais (centavos/100 — fronteira de UI, ADR-0004). */
	icms: number;
	incideAliquota: boolean;
}

/** Preparo serializado p/ o painel (reais + documentos mascarados). */
export interface PreparoItem {
	faturaId: number;
	status: string;
	dataReferencia: string;
	dataVencimento: string;
	/** Reais (centavos/100 — fronteira de UI, ADR-0004). */
	valorTotal: number;
	tipoFaturamento: string;
	cobrancas: {
		id: number;
		/** Reais (centavos/100 — fronteira de UI, ADR-0004). */
		valorTotal: number;
		nomeDevedor: string;
		documentoDevedor: string;
		emailDevedor: string;
		status: string;
		dataVencimento: string;
		/** Descrição exibida no boleto (f_descricao). */
		descricao: string;
		notas: {
			id: number;
			nome: string;
			cpfcnpj: string;
			email?: string;
			telefone?: string;
			endereco: Endereco;
			/** Reais (centavos/100 — fronteira de UI, ADR-0004). */
			total: number;
			cobrancaId: number;
			status: string;
			itens: PreparoItemItem[];
		}[];
	}[];
}

/**
 * Converte a resposta crua de `executarPreparacao` (centavos + docs limpos)
 * para o formato do painel (reais + mascarado) — o handler segue respondendo
 * em formato de domínio (as demais rotas API-key não mudam).
 */
export function serializarPreparo(cru: PreparoCru): PreparoItem {
	return {
		faturaId: cru.faturaId,
		status: cru.status,
		dataReferencia: cru.dataReferencia,
		dataVencimento: cru.dataVencimento,
		valorTotal: cru.valorTotal / 100,
		tipoFaturamento: cru.tipoFaturamento,
		cobrancas: cru.cobrancas.map((cb) => ({
			id: cb.id,
			valorTotal: cb.valorTotal / 100,
			nomeDevedor: cb.nomeDevedor,
			documentoDevedor: mascararDoc(cb.documentoDevedor),
			emailDevedor: cb.emailDevedor,
			status: cb.status,
			dataVencimento: cb.dataVencimento,
			descricao: cb.descricao,
			notas: cb.notas.map((n) => ({
				id: n.id,
				nome: n.nome,
				cpfcnpj: mascararDoc(n.cpfcnpj),
				email: n.email,
				telefone: n.telefone,
				endereco: n.endereco,
				total: n.total / 100,
				cobrancaId: n.cobrancaId,
				status: n.status,
				itens: n.itens.map((i) => ({
					item: i.item,
					codigo: i.codigo,
					descricao: i.descricao,
					cfop: i.cfop,
					cclass: i.cclass,
					quantidade: i.quantidade,
					unitario: i.unitario / 100,
					total: i.total / 100,
					aliqIcms: i.aliqIcms,
					bcIcms: i.bcIcms / 100,
					icms: i.icms / 100,
					incideAliquota: i.incideAliquota,
				})),
			})),
		})),
	};
}
