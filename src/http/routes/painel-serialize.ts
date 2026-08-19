/**
 * Serialização de UI do painel (domínio → JSON de exibição).
 *
 * Fronteira de exibição: a única camada onde **centavos → reais** acontecem
 * (ADR-0004 — o domínio fica em centavos inteiros; a conversão `cents/100`
 * vive SÓ aqui) e onde o documento **limpo → mascarado** (CPF
 * `000.000.000-00`, CNPJ `00.000.000/0000-00`). Status seguem os enums do
 * domínio (o front resolve a cor/ícone).
 */
import type { Fatura } from "#/domain/types";
import type { ErroEmissao, FaturaResumo } from "#/domain/ports/atacado.port";
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
