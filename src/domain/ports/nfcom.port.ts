/**
 * Porta do módulo NFCom (gateway SEFAZ — ADR-0001).
 *
 * Gateway SaaS `api.nfcom.com.br` (Vigo, OpenAPI 3.0.4). Auth `POST /api/auth`
 * (login/senha → bearer, **TTL 12h**) com cache no módulo. `ApiNFComEmitir` é
 * `additionalProperties: false` — **não há campo de referência própria** na
 * emissão (ao contrário do boleto Asaas), logo o input NÃO leva
 * `externalReference`. Lookups só por `chave` (44 dígitos) ou `/api/lista`
 * por `cpfcnpj`+janela de data (SPEC-0001 caso 15 — inspeção manual).
 *
 * `situacao` chega em uppercase do gateway; a ACL **normaliza p/ lowercase**
 * ao traduzir para `SituacaoNota`.
 */
import type { Endereco, Item, SituacaoNota } from "#/domain/types";

export interface DestinatarioNFCom {
	nome: string;
	/** CPF/CNPJ limpo. */
	cpfcnpj: string;
	endereco: Endereco;
	email?: string;
	rgie?: string;
	telefone?: string;
	uf: string;
	cidade: string;
}

export interface EmitirNFComInput {
	destinatario: DestinatarioNFCom;
	itens: Item[];
	/** CFOP default via env (SPEC-0002). */
	cfop: string;
	/** CCLASS default via env (SPEC-0002). */
	cclass: string;
	/**
	 * Deliberadamente SEM `externalReference` — o schema `ApiNFComEmitir` é
	 * `additionalProperties: false` (não aceita referência própria).
	 */
}

export interface EmitirNFComResultado {
	situacao: SituacaoNota;
	numero: number;
	serie: number;
	chave: string;
	protocolo: string;
	/** URLs ficam no gateway — o app persiste só as URLs (SPEC-0001). */
	pdfUrl: string;
	xmlUrl: string;
}

export interface NFComListaItem {
	chave: string;
	/** Situação em uppercase do gateway (AUTORIZADA/CANCELADA/...). */
	situacao: string;
	protocolo: string;
}

export interface NfcomPort {
	/** Bearer token (cache TTL 12h no módulo). */
	autenticar(): Promise<string>;
	emitirNFCom(input: EmitirNFComInput): Promise<EmitirNFComResultado>;
	/**
	 * `/api/lista` por `cpfcnpj`+janela de data — heurística para inspeção
	 * manual no crash pós-POST (SPEC-0001 caso 15).
	 */
	consultarLista(
		cpfcnpj: string,
		dataInicio: string,
		dataFim: string,
	): Promise<NFComListaItem[]>;
}
