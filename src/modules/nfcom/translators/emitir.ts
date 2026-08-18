/**
 * Translators de emissão NFCom (ADR-0001/0004).
 *
 * `ApiNFComEmitir` é `additionalProperties: false` — o payload NÃO leva
 * `externalReference` (nem qualquer campo extra) — o gateway rejeita. O
 * tradutor monta só os campos do schema; o resultado do gateway é traduzido
 * para `EmitirNFComResultado` (domínio), normalizando a situação (lowercase)
 * e mapeando `pdf`→`pdfUrl`, `xml`→`xmlUrl`.
 */
import type { Item } from "#/domain/types";
import type {
	EmitirNFComInput,
	EmitirNFComResultado,
} from "#/domain/ports/nfcom.port";
import { normalizarSituacao } from "./situacao";

/**
 * Item do gateway (`ApiNFComItemEmitir`) — campos exatos do swagger verificado
 * (ADR-0001): SEM `codigo`/`aliq_icms`/`icms`/`incide_aliquota` (additionalProperties:false).
 * Monetário em reais (o domínio carrega centavos — ADR-0004; conversão aqui).
 */
export interface ItemGateway {
	item: number;
	descricao: string;
	cclass: string;
	cfop: string;
	quantidade: number;
	unitario: number;
	total: number;
	bc_icms: number;
}

/**
 * Payload `ApiNFComEmitir` — TOP-LEVEL FLAT (swagger verificado, ADR-0001):
 * destinatário e endereço sobem ao topo (`nome`, `cpfcnpj`, `endereco`,
 * `endereco_numero`, `bairro`, `cidade`, `uf`, `cep`); `cfop`/`cclass` moram em
 * CADA item — não há `cfop`/`cclass` nem `destinatario` aninhado no topo.
 * `additionalProperties: false` — sem `externalReference` nem campos extras.
 */
export interface ApiNFComEmitir {
	nome: string;
	cpfcnpj: string;
	rgie?: string;
	endereco: string;
	endereco_numero: string;
	bairro: string;
	cidade: string;
	uf: string;
	cep: string;
	telefone?: string;
	email?: string;
	itens: ItemGateway[];
}

/** Resposta `NFCom` do gateway (campos relevantes). */
export interface NFComResposta {
	situacao: string;
	numero: number;
	serie: number;
	chave: string;
	protocolo: string;
	pdf: string;
	xml: string;
}

/** Converte centavos (domínio, inteiro) para reais (gateway, decimal) — ADR-0004. */
function centavosParaReais(centavos: number): number {
	return centavos / 100;
}

/** Monta o payload `ApiNFComEmitir` (flat) a partir do input de domínio. */
export function montarPayloadEmitir(input: EmitirNFComInput): ApiNFComEmitir {
	const { destinatario, itens } = input;
	const end = destinatario.endereco;
	return {
		nome: destinatario.nome,
		cpfcnpj: destinatario.cpfcnpj,
		rgie: destinatario.rgie,
		endereco: end.logradouro,
		endereco_numero: end.numero,
		bairro: end.bairro,
		cidade: end.cidade,
		uf: end.uf,
		cep: end.cep,
		telefone: destinatario.telefone,
		email: destinatario.email,
		itens: itens.map((item: Item, idx: number): ItemGateway => ({
			item: item.item ?? idx + 1,
			descricao: item.descricao,
			cclass: item.cclass,
			cfop: item.cfop,
			quantidade: item.quantidade,
			unitario: centavosParaReais(item.unitario),
			total: centavosParaReais(item.total),
			bc_icms: centavosParaReais(item.bcIcms),
		})),
	};
}

/** Traduz a resposta `NFCom` do gateway para `EmitirNFComResultado` (domínio). */
export function traduzirResultadoEmitir(
	resposta: NFComResposta,
): EmitirNFComResultado {
	return {
		situacao: normalizarSituacao(resposta.situacao),
		numero: resposta.numero,
		serie: resposta.serie,
		chave: resposta.chave,
		protocolo: resposta.protocolo,
		pdfUrl: resposta.pdf,
		xmlUrl: resposta.xml,
	};
}
