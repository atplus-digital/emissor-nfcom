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
	pdfUrl?: string;
	xmlUrl?: string;
}

export interface RegistrarErroInput {
	cobrancaId?: number;
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
