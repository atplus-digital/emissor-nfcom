/** Tipos espelhando o contrato dos endpoints /painel do backend. */

export interface User {
	id: number;
	nickname: string;
}

export type StatusFatura =
	| "a-emitir"
	| "emitindo"
	| "emitida"
	| "parcial"
	| "erro"
	| "pago"
	| "cancelada";

export type StatusCobranca = "a-emitir" | "emitida" | "erro";

export type StatusInternoNota = "a-emitir" | "emitida" | "erro" | "cancelada";

export type SituacaoNota = "autorizada" | "rejeitada" | "cancelada" | "processando";

export interface FaturaResumo {
	id: number;
	parceiroId: number;
	dataReferencia: string;
	dataVencimento: string;
	/** Valor em reais (number). */
	valorTotal: number;
	tipoFaturamento: string;
	status: StatusFatura;
	cobrancasCount: number;
}

export interface ItemView {
	item: number;
	codigo: string;
	descricao: string;
	cfop: string;
	cclass: string;
	quantidade: number;
	/** Centavos inteiros. */
	unitario: number;
	/** Centavos inteiros. */
	total: number;
	aliqIcms: number;
	/** Centavos inteiros. */
	icms: number;
}

export interface NotaView {
	id: number;
	nome: string;
	/** CPF/CNPJ mascarado. */
	cpfcnpj: string;
	statusInterno: StatusInternoNota;
	situacao: SituacaoNota;
	numero: string;
	serie: string;
	chave: string;
	protocolo: string;
	/** URL do PDF da nota (quando disponível no gateway NFCom). */
	pdfUrl?: string;
	/** Centavos inteiros. */
	total: number;
	itens: ItemView[];
}

export interface CobrancaView {
	id: number;
	status: StatusCobranca;
	boletoUrl: string | null;
	/** Centavos inteiros. */
	valorTotal: number;
	nomeDevedor: string;
	/** Documento mascarado. */
	documentoDevedor: string;
	dataVencimento: string;
	notas: NotaView[];
}

export interface FaturaDetalhe {
	id: number;
	parceiroId: number;
	dataReferencia: string;
	dataVencimento: string;
	/** Valor em reais (number). */
	valorTotal: number;
	tipoFaturamento: string;
	status: StatusFatura;
	cobrancas: CobrancaView[];
}

export interface EmissaoCobranca {
	id: number;
	status: StatusCobranca;
	boletoUrl: string | null;
	notas: EmissaoNota[];
}

export interface EmissaoNota {
	id: number;
	situacao: SituacaoNota;
	chave: string;
	protocolo: string;
}

export interface EmissaoErro {
	id: number;
	cobrancaId: number;
	notaId: number;
	erro: string;
	mensagem: string;
	statusCode: number;
}

export interface EmissaoView {
	faturaId: number;
	status: StatusFatura;
	cobrancas: EmissaoCobranca[];
	erros: EmissaoErro[];
}

/** Filtros da lista de faturas (query string). */
export interface FaturasFiltro {
	parceiroId?: string;
	dataReferencia?: string;
	status?: string;
}
