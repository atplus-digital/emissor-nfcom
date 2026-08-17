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

/** Item do gateway (snake/camel mistos conforme swagger). */
interface ItemGateway {
	codigo?: string;
	descricao: string;
	cfop: string;
	cclass: string;
	quantidade: number;
	unitario: number;
	total: number;
	aliq_icms: number;
	bc_icms: number;
	icms: number;
	incide_aliquota: boolean;
}

/** Payload `ApiNFComEmitir` — additionalProperties: false (sem externalReference). */
export interface ApiNFComEmitir {
	destinatario: {
		nome: string;
		cpfcnpj: string;
		endereco: {
			logradouro: string;
			numero: string;
			bairro: string;
			cep: string;
			cidade: string;
			uf: string;
		};
		email?: string;
		rgie?: string;
		telefone?: string;
		uf: string;
		cidade: string;
	};
	itens: ItemGateway[];
	cfop: string;
	cclass: string;
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

/** Monta o payload `ApiNFComEmitir` a partir do input de domínio. */
export function montarPayloadEmitir(input: EmitirNFComInput): ApiNFComEmitir {
	const { destinatario, itens, cfop, cclass } = input;
	return {
		destinatario: {
			nome: destinatario.nome,
			cpfcnpj: destinatario.cpfcnpj,
			endereco: {
				logradouro: destinatario.endereco.logradouro,
				numero: destinatario.endereco.numero,
				bairro: destinatario.endereco.bairro,
				cep: destinatario.endereco.cep,
				cidade: destinatario.endereco.cidade,
				uf: destinatario.endereco.uf,
			},
			email: destinatario.email,
			rgie: destinatario.rgie,
			telefone: destinatario.telefone,
			uf: destinatario.uf,
			cidade: destinatario.cidade,
		},
		itens: itens.map((item: Item): ItemGateway => ({
			codigo: item.codigo,
			descricao: item.descricao,
			cfop: item.cfop,
			cclass: item.cclass,
			quantidade: item.quantidade,
			unitario: item.unitario,
			total: item.total,
			aliq_icms: item.aliqIcms,
			bc_icms: item.bcIcms,
			icms: item.icms,
			incide_aliquota: item.incideAliquota,
		})),
		cfop,
		cclass,
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
