/**
 * Porta do módulo NFCom (gateway SEFAZ — ADR-0001).
 *
 * Porta de domínio para o gateway SEFAZ — o provedor e seus endpoints ficam
 * isolados em `src/modules/nfcom` (ADR-0001). Auth com bearer token (TTL 12h,
 * cache no módulo). A emissão não tem campo de referência própria — o input
 * NÃO leva `externalReference` (schemas do gateway podem ser
 * `additionalProperties: false`). Lookups por chave ou por cpfcnpj+janela de
 * data (SPEC-0001 caso 15 — inspeção manual).
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
	/**
	 * Deliberadamente SEM `externalReference` — o schema `ApiNFComEmitir` é
	 * `additionalProperties: false` (não aceita referência própria).
	 */
}

export interface EmitirNFComResultado {
	situacao: SituacaoNota;
	/** Identificação `[opt]` no swagger — ausente em situações não-autorizadas. */
	numero?: number;
	serie?: number;
	chave?: string;
	protocolo?: string;
	/** Ambiente SEFAZ da emissão (integer — produção/homologação). */
	ambiente?: number;
	/** QR Code Pix da nota (campo `pix` do response `NFCom`). */
	pixUrl?: string;
	/** URLs ficam no gateway — o app persiste só as URLs (SPEC-0001). */
	pdfUrl?: string;
	xmlUrl?: string;
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
		inicio: string,
		fim: string,
	): Promise<NFComListaItem[]>;
}
