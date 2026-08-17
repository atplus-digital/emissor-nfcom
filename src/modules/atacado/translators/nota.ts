/**
 * Translator Nota: domínio `Nota` ↔ `f_*` (t_nfcom_notas) — ADR-0004.
 */
import type {
	Nota,
	SituacaoNota,
	StatusInternoNota,
} from "#/domain/types";
import type { CriarNotaInput } from "#/domain/ports/atacado.port";
import { centsToReal, desmascararDoc, realToCents } from "./money";
import { itemToDomain, type ItemExterno } from "./item";

export interface NotaExterna {
	id: number;
	f_fk_cobranca: number;
	f_nome: string;
	f_cpfcnpj: string;
	f_email: string;
	f_endereco: string;
	f_endereco_numero: string;
	f_bairro: string;
	f_cep: string;
	f_cidade: string;
	f_uf: string;
	f_rgie: string;
	f_telefone: string;
	f_status_interno: StatusInternoNota;
	f_situacao?: string;
	f_numero?: number;
	f_serie?: number;
	f_chave?: string;
	f_protocolo?: string;
	f_pdf?: string;
	f_xml?: string;
	f_total: number;
	f_nota_itens?: ItemExterno[];
}

export function notaToCreate(input: CriarNotaInput): Record<string, unknown> {
	return {
		f_nome: input.nome,
		f_cpfcnpj: input.cpfcnpj,
		f_email: input.email ?? "",
		f_endereco: input.endereco.logradouro,
		f_endereco_numero: input.endereco.numero,
		f_bairro: input.endereco.bairro,
		f_cep: input.endereco.cep,
		f_cidade: input.endereco.cidade,
		f_uf: input.endereco.uf,
		f_rgie: input.rgie ?? "",
		f_telefone: input.telefone ?? "",
		f_status_interno: input.statusInterno,
		f_total: centsToReal(input.total),
	};
}

export function notaToDomain(e: NotaExterna, cobrancaId: number): Nota {
	return {
		id: e.id,
		cobrancaId,
		nome: e.f_nome,
		cpfcnpj: desmascararDoc(e.f_cpfcnpj),
		email: e.f_email || undefined,
		endereco: {
			logradouro: e.f_endereco,
			numero: e.f_endereco_numero,
			bairro: e.f_bairro,
			cep: e.f_cep,
			cidade: e.f_cidade,
			uf: e.f_uf,
		},
		rgie: e.f_rgie || undefined,
		telefone: e.f_telefone || undefined,
		uf: e.f_uf,
		cidade: e.f_cidade,
		statusInterno: e.f_status_interno,
		situacao: (e.f_situacao?.toLowerCase() as SituacaoNota) || undefined,
		numero: e.f_numero,
		serie: e.f_serie,
		chave: e.f_chave,
		protocolo: e.f_protocolo,
		pdfUrl: e.f_pdf || undefined,
		xmlUrl: e.f_xml || undefined,
		total: realToCents(e.f_total),
		itens: (e.f_nota_itens ?? []).map(itemToDomain),
	};
}
