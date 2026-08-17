/**
 * Translator de situação do gateway NFCom → domínio (ADR-0001/0004).
 *
 * O gateway reporta `situacao` em **uppercase** (swagger: AUTORIZADA/CANCELADA
 * confirmados; PROCESSANDO/REJEITADA TBC). A ACL **normaliza p/ lowercase** ao
 * traduzir para `SituacaoNota` (domínio). Case-insensitive + trim.
 */
import type { SituacaoNota } from "#/domain/types";

const MAPA: Record<string, SituacaoNota> = {
	autorizada: "autorizada",
	cancelada: "cancelada",
	processando: "processando",
	rejeitada: "rejeitada",
};

/** Normaliza a situação do gateway (uppercase) para SituacaoNota (lowercase). */
export function normalizarSituacao(situacao: string): SituacaoNota {
	const chave = situacao.trim().toLowerCase();
	const mapeada = MAPA[chave];
	if (!mapeada) {
		throw new Error(
			`Situação desconhecida do gateway NFCom: "${situacao}" (normalizada: "${chave}")`,
		);
	}
	return mapeada;
}
