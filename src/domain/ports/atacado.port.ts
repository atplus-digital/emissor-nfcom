/**
 * Porta do módulo Atacado (CRM NocoBase — ADR-0004).
 *
 * O Atacado é a **fonte de domínio** (faturas, cobranças, notas). O app lê e
 * escreve pela porta; tipos externos `f_*` (monetário string com vírgula,
 * CPF/CNPJ mascarado) não cruzam a fronteira — o translator do módulo
 * `atacado` normaliza (centavos inteiros, documento limpo) ao implementar.
 *
 * Writes de **mudança de estado de emissão** passam pelo outbox (ADR-0003) no
 * módulo, não aqui — estas portas são o contrato; o relay é detalhe do módulo.
 * A preparação da árvore (criação) é **direta com rollback manual** (desvio
 * explícito de ADR-0003, SPEC-0002): a resposta 201 precisa dos IDs criados
 * agora, sem outbox.
 */
import type {
	Cliente,
	Cobranca,
	Endereco,
	Fatura,
	Item,
	Parceiro,
	Plano,
	StatusCobranca,
	StatusFatura,
	StatusInternoNota,
	SituacaoNota,
	TipoFaturamento,
} from "#/domain/types";

/** Input de criação de fatura (campos de domínio; o módulo traduz p/ `f_*`). */
export interface CriarFaturaInput {
	parceiroId: number;
	dataReferencia: string;
	dataVencimento: string;
	valorTotal: number;
	tipoFaturamento: Fatura["tipoFaturamento"];
	status: StatusFatura;
}

export interface CriarCobrancaInput {
	/** Descrição exibida na cobrança (campo obrigatório `f_descricao` do CRM) —
	 * derivada dos itens + referência de mês (SPEC-0002). */
	descricao: string;
	valorTotal: number;
	nomeDevedor: string;
	documentoDevedor: string;
	emailDevedor: string;
	status: StatusCobranca;
	dataVencimento: string;
}

export interface CriarNotaInput {
	nome: string;
	cpfcnpj: string;
	email?: string;
	endereco: Endereco;
	rgie?: string;
	telefone?: string;
	uf: string;
	cidade: string;
	statusInterno: StatusInternoNota;
	total: number;
}

export interface CriarItemInput {
	codigo?: string;
	descricao: string;
	cfop: string;
	cclass: string;
	quantidade: number;
	unitario: number;
	total: number;
	aliqIcms: number;
	bcIcms: number;
	icms: number;
	incideAliquota: boolean;
}

export interface AtualizarStatusNotaInput {
	statusInterno?: StatusInternoNota;
	situacao?: SituacaoNota;
	numero?: number;
	serie?: number;
	chave?: string;
	protocolo?: string;
	/** Ambiente SEFAZ da emissão (produção/homologação) — `f_ambiente`. */
	ambiente?: number;
	pdfUrl?: string;
	xmlUrl?: string;
	/** QR Code Pix da nota — `f_qrcodepix`. */
	pixUrl?: string;
}

export interface RegistrarErroInput {
	cobrancaId?: number;
	notaId?: number;
	erro: string;
	mensagem: string;
	statusCode?: string;
}

/**
 * Filtro da listagem de faturas do painel (leitura da fonte de domínio).
 * Todos os campos são opcionais — a lista só filtra pelos campos presentes.
 */
export interface FiltroFaturas {
	parceiroId?: number;
	/** Mês de referência (`YYYY-MM-DD`). */
	dataReferencia?: string;
	status?: StatusFatura;
}

/**
 * Resumo de fatura p/ listagem do painel — sem a árvore (cobranças/notas/itens
 * ficam para o detalhe, `getFaturaPorId`). Monetário em centavos (ADR-0004).
 */
export interface FaturaResumo {
	id: number;
	parceiroId: number;
	dataReferencia: string;
	dataVencimento: string;
	/** Total da fatura, em centavos. */
	valorTotal: number;
	tipoFaturamento: TipoFaturamento;
	status: StatusFatura;
	/** Quantidade de cobranças da fatura (sem carregar o conteúdo). */
	cobrancasCount: number;
}

/** Erro de emissão registrado (`t_nfcom_erros`) — leitura p/ inspeção (SPEC-0001). */
export interface ErroEmissao {
	id: number;
	/** Cobrança de origem (erro de boleto) — ausente quando é erro de nota. */
	cobrancaId?: number;
	/** Nota de origem (erro de emissão NFCom) — ausente quando é erro de cobrança. */
	notaId?: number;
	erro: string;
	mensagem: string;
	statusCode?: string;
}

export interface AtacadoPort {
	// Leitura (fonte de domínio)
	buscarParceiroPorId(parceiroId: number): Promise<Parceiro | null>;
	buscarClientesAtivosPorParceiro(parceiroId: number): Promise<Cliente[]>;
	buscarPlanosDeServico(): Promise<Plano[]>;
	buscarFaturaPorChave(
		parceiroId: number,
		dataReferencia: string,
	): Promise<Fatura | null>;
	/**
	 * Carrega a fatura com a árvore completa (cobranças + notas + itens) por id.
	 * Retorna `null` quando o id não existe (404 do Atacado).
	 */
	getFaturaPorId(id: number): Promise<Fatura | null>;
	/**
	 * Erros de emissão de uma fatura (leitura p/ `GET /emissao`, SPEC-0001).
	 * Filtra `t_nfcom_erros` pelos ids de cobrança/nota da fatura — a tabela
	 * não tem FK direta de fatura, então os ids são resolvidos pelo caller.
	 * `[]` quando não há ids (fatura sem cobranças/notas) ou erros.
	 */
	buscarErrosPorFatura(
		cobrancaIds: number[],
		notaIds: number[],
	): Promise<ErroEmissao[]>;
	/**
	 * Lista resumos de fatura com filtros opcionais (painel). Sem a árvore —
	 * só as cobranças anexadas p/ contar (`cobrancasCount`). `[]` quando o
	 * Atacado responde 404 (nenhum registro com o filtro).
	 */
	listarFaturas(filtro: FiltroFaturas): Promise<FaturaResumo[]>;

	// Criação da árvore (direta, com rollback manual — SPEC-0002)
	criarFatura(input: CriarFaturaInput): Promise<{ id: number }>;
	criarCobranca(
		faturaId: number,
		input: CriarCobrancaInput,
	): Promise<{ id: number }>;
	criarNota(cobrancaId: number, input: CriarNotaInput): Promise<{ id: number }>;
	criarItem(notaId: number, input: CriarItemInput): Promise<void>;

	/**
	 * Remove a árvore de cobranças/notas/itens de uma fatura (a fatura é
	 * reutilizada no modo atualização, SPEC-0002 caso 6). Ordem: itens → notas
	 * → cobranças.
	 */
	removerArvore(faturaId: number): Promise<void>;

	// Atualização de estado (pelo outbox no módulo — ADR-0003)
	atualizarStatusFatura(id: number, status: StatusFatura): Promise<void>;
	atualizarStatusCobranca(
		id: number,
		status: StatusCobranca,
		extra?: { idExterno?: string; linkFatura?: string; dataEmissao?: string },
	): Promise<void>;
	atualizarStatusNota(
		id: number,
		input: AtualizarStatusNotaInput,
	): Promise<void>;
	registrarErro(input: RegistrarErroInput): Promise<void>;
}
