/**
 * Mapeamento gateway → nota (SPEC-0001 passo 4c): traduz a situação reportada pelo
 * gateway SEFAZ (lowercase no domínio, a ACL normaliza o case do swagger) + a
 * condição de erro local nos dois campos da nota:
 *
 * - `f_situacao` (espelho do gateway, lowercase no domínio)
 * - `f_status_interno` (máquina interna: a-emitir/emitida/erro/cancelada)
 *
 *   autorizada   → emitida + autorizada
 *   processando  → a-emitir (retry) + processando        (caso 6)
 *   rejeitada    → erro (fatal) + rejeitada              (caso 7)
 *   cancelada    → erro (fatal, reportada) + cancelada  (caso 7)
 *   erro local   → erro + situacao INALTERADA            (timeout/rede/401 exausto)
 *
 * `f_status_interno=cancelada` é **reservado à SPEC-0003** (cancelamento iniciado pelo
 * app) — este ciclo NÃO o produz; a `cancelada` do gateway vira `erro` aqui.
 */
import type { SituacaoNota, StatusInternoNota } from "#/domain/types";

export interface MapeamentoSituacao {
	statusInterno: StatusInternoNota;
	situacao?: SituacaoNota;
}

/**
 * Mapeia a situação do gateway (+ flag de erro local) para os campos da nota.
 * `erroLocal=true` indica falha sem situação reportada (timeout/rede/401 exausto):
 * prevalece como `erro` e a `situacao` permanece inalterada (não espelha situação
 * inexistente).
 */
export function mapearSituacaoNota(
	situacaoGateway: SituacaoNota | undefined,
	erroLocal?: boolean,
): MapeamentoSituacao {
	if (erroLocal) {
		return { statusInterno: "erro", situacao: undefined };
	}
	switch (situacaoGateway) {
		case "autorizada":
			return { statusInterno: "emitida", situacao: "autorizada" };
		case "processando":
			return { statusInterno: "a-emitir", situacao: "processando" };
		case "rejeitada":
			return { statusInterno: "erro", situacao: "rejeitada" };
		case "cancelada":
			// reportada pelo gateway (não iniciada pelo app) → erro neste ciclo.
			return { statusInterno: "erro", situacao: "cancelada" };
		default:
			// sem situacao e sem erro local → ainda a-emitir
			return { statusInterno: "a-emitir", situacao: undefined };
	}
}
