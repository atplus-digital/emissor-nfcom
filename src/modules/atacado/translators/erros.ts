/**
 * Translator de erros de emissão: `t_nfcom_erros` → domínio `ErroEmissao`.
 * Leitura p/ inspeção (`GET /emissao`, SPEC-0001).
 */
import type { ErroEmissao } from "#/domain/ports/atacado.port";

export interface ErroExterna {
	id: number;
	f_fk_cobranca: number;
	f_fk_nfcom: number;
	f_erro: string;
	f_mensagem: string;
	f_status_code: string;
}

export function erroToDomain(e: ErroExterna): ErroEmissao {
	return {
		id: e.id,
		cobrancaId: e.f_fk_cobranca || undefined,
		notaId: e.f_fk_nfcom || undefined,
		erro: e.f_erro,
		mensagem: e.f_mensagem,
		statusCode: e.f_status_code || undefined,
	};
}
