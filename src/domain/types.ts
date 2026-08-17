/**
 * Tipos de domínio do emissor-nfcom (ADR-0004).
 *
 * Regra central: o domínio é autocontido — tipos externos (CRM `f_*`, provedores
 * Asaas/NFCom) NÃO cruzam a fronteira do módulo. Aqui vive só o domínio:
 * - Monetário em **centavos inteiros** (number) — nunca unidade real/float
 *   (ADR-0004); conversão só no translator do módulo `atacado`.
 * - Documentos (CPF/CNPJ) em strings **limpas** (sem máscara); desmascaramento
 *   é na fronteira do módulo.
 * - `situacao` da nota em **lowercase** no domínio; a ACL normaliza o case
 *   uppercase do gateway (swagger) ao traduzir.
 *
 * Agregados (Fase 2b) e módulos (Fase 3) consomem estes tipos; portas em
 * `src/domain/ports/` são as interfaces que os módulos implementam.
 */

// ============================================================
// Enums (unions literais — espelham os enums do CRM quando aplicável)
// ============================================================

export type TipoFaturamento =
	| "parceiro"
	| "via-parceiro"
	| "cofaturamento"
	| "cliente-final";

export type StatusFatura =
	| "criada"
	| "a-emitir"
	| "emitindo"
	| "emitida"
	| "parcial"
	| "erro"
	| "pago"
	| "cancelada";

/** Status da cobrança no ciclo de emissão (espelha `f_status` da cobrança). */
export type StatusCobranca = "a-emitir" | "emitida" | "erro";

/**
 * Máquina interna da nota (enum `f_status_interno` do CRM). `cancelada` é
 * **reservado** à SPEC-0003 (cancelamento) — o primeiro ciclo só produz
 * `a-emitir`/`emitida`/`erro` (SPEC-0001).
 */
export type StatusInternoNota = "a-emitir" | "emitida" | "erro" | "cancelada";

/**
 * Espelho da situação reportada pelo gateway SEFAZ (campo `f_situacao`).
 * Lowercase no domínio; a ACL normaliza o case uppercase do swagger
 * (`AUTORIZADA`/`CANCELADA` confirmados; `PROCESSANDO`/`REJEITADA` TBC).
 */
export type SituacaoNota = "autorizada" | "rejeitada" | "cancelada" | "processando";

/** Classificação de erro p/ a estratégia de retry do BullMQ. */
export type TipoErro = "RETRYABLE" | "FATAL";

/**
 * Erro de validação pré-persistência (SPEC-0002 casos 1-4, 13). Lista de
 * erros bloqueantes (vazio = válido); cada um vira `422` na rota.
 */
export interface ErroValidacao {
	tipo: TipoErro;
	/**
	 * Campo/identificador do alvo inválido (ex.: `cpfcnpj`, `endereco`).
	 * Opcional: erros gerais de cálculo (ex.: consistência do total) não se
	 * atam a um campo.
	 */
	campo?: string;
	mensagem: string;
}

// ============================================================
// Tipos de domínio
// ============================================================

export interface Endereco {
	logradouro: string;
	numero: string;
	bairro: string;
	cep: string;
	cidade: string;
	uf: string;
}

export interface Item {
	/** Sequencial do item na nota (opcional — atribuído na persistência). */
	item?: number;
	codigo?: string;
	descricao: string;
	cfop: string;
	cclass: string;
	quantidade: number;
	/** Centavos inteiros (ADR-0004). */
	unitario: number;
	/** Centavos inteiros. */
	total: number;
	/** Alíquota de ICMS (fração 0..1). */
	aliqIcms: number;
	/** Base de cálculo do ICMS, em centavos. */
	bcIcms: number;
	/** Valor do ICMS, em centavos. */
	icms: number;
	incideAliquota: boolean;
}

export interface Nota {
	id?: number;
	cobrancaId: number;
	nome: string;
	/** CPF/CNPJ limpo (sem máscara). */
	cpfcnpj: string;
	email?: string;
	/** Endereço do destinatário — exigido pelo MOC da NFCom (SPEC-0002 caso 13). */
	endereco: Endereco;
	rgie?: string;
	telefone?: string;
	uf: string;
	cidade: string;
	statusInterno: StatusInternoNota;
	/** Espelho do gateway; ausente até a emissão retornar situação. */
	situacao?: SituacaoNota;
	numero?: number;
	serie?: number;
	/** Chave de acesso SEFAZ (44 dígitos). */
	chave?: string;
	protocolo?: string;
	/** URLs ficam no gateway — o app não baixa arquivos (SPEC-0001). */
	pdfUrl?: string;
	xmlUrl?: string;
	/** Total da nota, em centavos. */
	total: number;
	itens: Item[];
}

export interface Cobranca {
	id?: number;
	faturaId: number;
	/** Total da cobrança, em centavos. */
	valorTotal: number;
	nomeDevedor: string;
	/** CPF/CNPJ limpo do devedor. */
	documentoDevedor: string;
	emailDevedor: string;
	status: StatusCobranca;
	/** `f_id_externo` — id do boleto no Asaas. */
	idExterno?: string;
	linkFatura?: string;
	dataEmissao?: string;
	dataVencimento: string;
	notas: Nota[];
}

export interface Fatura {
	id?: number;
	parceiroId: number;
	/**
	 * Mês de referência, normalizado para `YYYY-MM-01` (chave natural,
	 * SPEC-0002). Computado em `America/Sao_Paulo` (CONVENTIONS.md).
	 */
	dataReferencia: string;
	/** Vencimento no mês seguinte ao da referência (SPEC-0002 caso 10). */
	dataVencimento: string;
	/** Total da fatura, em centavos. */
	valorTotal: number;
	tipoFaturamento: TipoFaturamento;
	status: StatusFatura;
	cobrancas: Cobranca[];
}

export interface Parceiro {
	id: number;
	razaoSocial: string;
	fantasia?: string;
	/** CNPJ limpo. */
	cnpj: string;
	emailFaturamento: string;
	/** Dia do mês de vencimento (default 10 se ausente — SPEC-0002 caso 10). */
	diaVencimento: number;
	endereco: Endereco;
	/** Inscrição estadual. */
	ie?: string;
}

export interface Linha {
	planoId: number;
	descricao: string;
	/** Unitário em centavos (preço do plano). */
	unitario: number;
	quantidade: number;
}

export interface Cliente {
	id: number;
	nome: string;
	fantasia?: string;
	/** CPF/CNPJ limpo. */
	cpfcnpj: string;
	email?: string;
	endereco: Endereco;
	linhas: Linha[];
}

export interface Plano {
	id: number;
	descricao: string;
	/** Preço em centavos. */
	preco: number;
}

export interface EventoWebhook {
	/**
	 * Determinístico por `(faturaId, alvo, estado, timestamp-do-evento)`
	 * (SPEC-0001 passo 6) — estável entre retries p/ dedup no receptor.
	 */
	eventoId: string;
	faturaId: number;
	tipo: "fatura.status" | "cobranca.status" | "nfcom.situacao";
	alvo: {
		faturaId?: number;
		cobrancaId?: number;
		notaId?: number;
	};
	estado: string;
	erros?: {
		cobrancaId?: number;
		tipo: TipoErro;
		mensagem: string;
	}[];
	timestamp: string;
}
