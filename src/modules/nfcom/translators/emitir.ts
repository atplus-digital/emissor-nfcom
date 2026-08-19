/**
 * Translators de emissão NFCom (ADR-0001/0004).
 *
 * `ApiNFComEmitir` é `additionalProperties: false` — o payload NÃO leva
 * `externalReference` (nem qualquer campo extra) — o gateway rejeita. O
 * tradutor monta só os campos do schema; o resultado do gateway é traduzido
 * para `EmitirNFComResultado` (domínio), normalizando a situação (lowercase)
 * e mapeando `pdf`→`pdfUrl`, `xml`→`xmlUrl`.
 */
import { mascararDoc } from "#/domain/fatura/cpf-cnpj";
import { normalizarIE } from "#/domain/fiscal/ie";
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

/** Resposta `NFCom` do gateway (campos relevantes).
 *
 * Swagger verificado (ADR-0001): `/api/emitir` retorna `NFCom`, onde os campos
 * de identificação são **opcionais** (`[opt]`) — podem vir ausentes em situações
 * não-autorizadas (ex.: `REJEITADA` antes de gerar chave). Por isso o contrato
 * os tipa como condicionais e o translator passa preservando a ausência em vez
 * de assumir presença. `pix` e `ambiente` também são `[opt]` — o primeiro é o
 * QR/Pix da nota emitida (antigo gap identificado na revisão), o segundo indica
 * o ambiente SEFAZ (produção/homologação) da emissão.
 */
export interface NFComResposta {
	situacao: string;
	numero?: number;
	serie?: number;
	chave?: string;
	protocolo?: string;
	/** Ambiente SEFAZ da emissão (integer no swagger — produção/homologação). */
	ambiente?: number;
	/** QR Code Pix da nota (campo `pix` do response `NFCom`). */
	pix?: string;
	pdf?: string;
	xml?: string;
}

/** Converte centavos (domínio, inteiro) para reais (gateway, decimal) — ADR-0004. */
function centavosParaReais(centavos: number): number {
	return centavos / 100;
}

/**
 * Opções de fronteira do payload (Defeito B). `ieIsento` é o fallback de
 * `FISCAL_IE_ISENTO` (env opcional, ligada pelo composition root — o tradutor
 * não lê env, como o domínio não lê env, ADR-0004): usado só quando a IE do
 * destinatário não é numérica (isenta/ausente).
 */
export interface OptsMontarPayloadEmitir {
	ieIsento?: string;
}

/**
 * Monta o payload `ApiNFComEmitir` (flat) a partir do input de domínio.
 *
 * `rgie` passa por `normalizarIE` só nesta fronteira (o domínio carrega o
 * valor cru): o CRM cadastra parceiros isentos com o literal "ISENTO" em
 * `f_ie`, e o gateway NFCom (Vigo/SEFAZ) trata IE não-numérica como inválida
 * → rejeição `IE do Destinatário não informada`. Sem IE numérica, o campo é
 * omitido; se `opts.ieIsento` estiver configurada, ela entra como fallback
 * (placeholder p/ o caso de o gateway exigir um valor — confirmar com contador).
 */
export function montarPayloadEmitir(
	input: EmitirNFComInput,
	opts: OptsMontarPayloadEmitir = {},
): ApiNFComEmitir {
	const { destinatario, itens } = input;
	const end = destinatario.endereco;
	const rgie = normalizarIE(destinatario.rgie) ?? opts.ieIsento;
	return {
		nome: destinatario.nome,
		// O gateway NFCom (Vigo) roteia o elemento XML `CPF` vs `CNPJ` pela
		// presença dos caracteres de formatação, não pelo comprimento — um
		// CNPJ limpo (14 dígitos) é lido como CPF (TCpf aceita só 11) e
		// rejeitado com `Falha no schema XML`. O domínio carrega o documento
		// limpo (desmascararDoc); a máscara é aplicada só nesta fronteira.
		cpfcnpj: mascararDoc(destinatario.cpfcnpj),
		rgie,
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

/** Traduz a resposta `NFCom` do gateway para `EmitirNFComResultado` (domínio).
 *
 * Campos de identificação (numero/serie/chave/protocolo) são `[opt]` no
 * swagger — o translator os repassa como `undefined` quando ausentes, não
 * assume um valor (quem persiste decide como gravar). `pdf`/`xml`/`pix`/`ambiente`
 * são mapeados de forma análoga (camelCase + domínio).
 */
export function traduzirResultadoEmitir(
	resposta: NFComResposta,
): EmitirNFComResultado {
	return {
		situacao: normalizarSituacao(resposta.situacao),
		numero: resposta.numero,
		serie: resposta.serie,
		chave: resposta.chave,
		protocolo: resposta.protocolo,
		ambiente: resposta.ambiente,
		pixUrl: resposta.pix,
		pdfUrl: resposta.pdf,
		xmlUrl: resposta.xml,
	};
}
