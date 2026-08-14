/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: pnpm generate-types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */

import { z } from "zod";

// ============================================================
// LABELS (single source of truth)
// ============================================================
export const NFCOM_NOTAS_FIELD_LABELS = {
	createdAt: "Criado em",
	createdBy: "Criado por",
	createdById: "createdById",
	f_ambiente: "Ambiente",
	f_bairro: "Bairro",
	f_bc_icms: "BC ICMS",
	f_cep: "CEP",
	f_chave: "Chave",
	f_cidade: "Cidade",
	f_cobranca: "Cobrança",
	f_codigobarras: "Código de Barras",
	f_cpfcnpj: "CPF/CNPJ",
	f_email: "Email",
	f_emissao: "Emissao",
	f_endereco: "Endereço",
	f_endereco_numero: "Endereço Número",
	f_erro: "Erro de Emissão",
	f_fk_cobranca: "f_fk_cobranca",
	f_icms: "ICMS",
	f_linhadigitavel: "Linha Digitável",
	f_mensagem: "Mensagem",
	f_nome: "Nome",
	f_nota_itens: "Itens da Nota",
	f_numero: "Numero",
	f_pdf: "PDF",
	f_protocolo: "Protocolo",
	f_qrcodepix: "Qr Code Pix",
	f_rgie: "RG/IE",
	f_serie: "Série",
	f_situacao: "Situação",
	f_status_interno: "Status Interno",
	f_telefone: "Telefone",
	f_total: "Total",
	f_uf: "UF",
	f_xml: "XML",
	id: "ID",
	updatedAt: "Última atualização em",
	updatedBy: "Última atualização por",
	updatedById: "updatedById",
} as const;

export const FIELD_LABELS = NFCOM_NOTAS_FIELD_LABELS;

export const NFCOM_NOTAS_STATUS_INTERNO_LABELS = {
	"a-emitir": "A Emitir",
	emitida: "Emitida",
	erro: "Erro ao Emitir",
	cancelada: "Cancelada",
} as const;

export const ENUM_LABELS_BY_FIELD = {
	f_status_interno: NFCOM_NOTAS_STATUS_INTERNO_LABELS,
} as const;

// ============================================================
// ENUM SCHEMAS (validação em runtime)
// ============================================================
export const nfcom_notasStatusInternoSchema = z.enum(
	["a-emitir", "emitida", "erro", "cancelada"],
	{
		error: () => ({
			message:
				"status_interno: valores válidos são [A Emitir, Emitida, Erro ao Emitir, Cancelada]",
		}),
	},
);

// ============================================================
// ENUM TYPES (inferidos dos schemas)
// ============================================================
export type NfcomNotasStatusInterno = z.infer<
	typeof nfcom_notasStatusInternoSchema
>;
