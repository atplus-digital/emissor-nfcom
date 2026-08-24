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

export type SituacaoNota =
	| "autorizada"
	| "rejeitada"
	| "cancelada"
	| "processando";

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
	/** Nome do parceiro (quando disponível). */
	parceiroNome?: string;
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
	/** Valor em reais (number) — o endpoint já converte centavos → reais. */
	total: number;
	itens: ItemView[];
}

export interface CobrancaView {
	id: number;
	status: StatusCobranca;
	boletoUrl: string | null;
	/** Valor em reais (number) — o endpoint já converte centavos → reais. */
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

/** Tipos de faturamento aceitos no preparo de fatura. */
export type TipoFaturamento =
	| "parceiro"
	| "via-parceiro"
	| "cofaturamento"
	| "cliente-final";

/** Endereço em forma de view (strings prontas para exibir). */
export interface EnderecoView {
	logradouro: string;
	numero: string;
	bairro: string;
	cep: string;
	cidade: string;
	uf: string;
}

/** Parceiro em forma de resumo (lista/seletor). */
export interface ParceiroResumo {
	id: number;
	razaoSocial: string;
	fantasia?: string;
	/** CNPJ mascarado. */
	cnpj: string;
}

/** Parceiro em forma de detalhe. */
export interface ParceiroDetalhe {
	id: number;
	razaoSocial: string;
	fantasia?: string;
	/** CNPJ mascarado. */
	cnpj: string;
	emailFaturamento: string;
	diaVencimento: number;
	ie?: string;
	endereco: EnderecoView;
}

/** Linha de plano de um cliente. */
export interface LinhaView {
	planoId: number;
	descricao: string;
	/** Valor em reais (number). */
	unitario: number;
	quantidade: number;
}

/** Cliente ativo de um parceiro (somente leitura). */
export interface ClienteView {
	id: number;
	nome: string;
	fantasia?: string;
	/** CPF/CNPJ mascarado. */
	cpfcnpj: string;
	email?: string;
	endereco: EnderecoView;
	linhas: LinhaView[];
}

/** Body do POST /api/faturas/preparar. */
export interface PrepararInput {
	parceiroId: number;
	/** Data de referência em "YYYY-MM-DD". */
	dataReferencia: string;
	tipoFaturamento: TipoFaturamento;
}

/** Item de nota montado no preparo (valores em reais). */
export interface PrepararItem {
	/** Sequencial do item (quando definido; senão, ordem na lista + 1). */
	item?: number;
	codigo?: string;
	descricao: string;
	cfop: string;
	cclass: string;
	quantidade: number;
	/** Valor em reais (number). */
	unitario: number;
	/** Valor em reais (number). */
	total: number;
	/** Alíquota de ICMS (fração 0..1). */
	aliqIcms: number;
	/** Valor em reais (number). */
	bcIcms: number;
	/** Valor em reais (number). */
	icms: number;
	incideAliquota: boolean;
}

/** Nota montada no preparo (status inicial). */
export interface PrepararNota {
	id: number;
	nome: string;
	/** CPF/CNPJ mascarado. */
	cpfcnpj: string;
	email?: string;
	telefone?: string;
	endereco: EnderecoView;
	/** Valor em reais (number). */
	total: number;
	cobrancaId: number;
	status: StatusInternoNota;
	itens: PrepararItem[];
}

/** Cobrança montada no preparo (status inicial). */
export interface PrepararCobranca {
	id: number;
	/** Valor em reais (number). */
	valorTotal: number;
	nomeDevedor: string;
	/** Documento mascarado. */
	documentoDevedor: string;
	emailDevedor: string;
	status: StatusCobranca;
	dataVencimento: string;
	/** Descrição exibida no boleto (f_descricao). */
	descricao: string;
	notas: PrepararNota[];
}

/** Resultado do preparo de fatura. */
export interface PrepararResultado {
	faturaId: number;
	status: StatusFatura;
	dataReferencia: string;
	dataVencimento: string;
	/** Valor em reais (number). */
	valorTotal: number;
	tipoFaturamento: TipoFaturamento;
	cobrancas: PrepararCobranca[];
}

/** Resultado do POST /api/faturas/:id/emitir. */
export interface EmitirResultado {
	jobId: string;
	statusUrl: string;
}

/** Estados de job que o painel coleta (GET /api/filas). */
export type EstadoJobFila =
	| "waiting"
	| "active"
	| "delayed"
	| "failed"
	| "completed";

/** Job BullMQ na forma que o /painel/api/filas entrega. */
export interface JobFila {
	id: string;
	nome: string;
	estado: EstadoJobFila;
	tentativas: number;
	/** Criação do job (ms epoch). */
	criadoEm: number;
	processadoEm: number | null;
	finalizadoEm: number | null;
	falha: string | null;
	/** faturaId do data do job (só jobs de emissão levam). */
	faturaId: number | null;
	paiId: string | null;
}

/** Fila BullMQ na forma que o /painel/api/filas entrega. */
export interface FilaView {
	nome: string;
	/** Contagens cruas por estado (chaves BullMQ: waiting/active/delayed/paused/completed/failed). */
	contagens: Record<string, number>;
	pausada: boolean;
	workers: number;
	/** Jobs recentes por estado (até 50 por estado). */
	jobs: JobFila[];
}

/** Snapshot das filas (o viewer faz poll a cada poucos segundos). */
export interface FilasSnapshot {
	geradoEm: number;
	filas: FilaView[];
}
