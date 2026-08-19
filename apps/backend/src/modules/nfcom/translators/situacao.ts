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

/** Normaliza a situação do gateway (uppercase) para SituacaoNota (lowercase).
 * Lança para situação desconhecida — usado no caminho de emissão, onde a
 * resposta é do nosso POST e o valor é esperado. */
export function normalizarSituacao(situacao: string): SituacaoNota {
	const mapeada = MAPA[situacao.trim().toLowerCase()];
	if (!mapeada) {
		throw new Error(
			`Situação desconhecida do gateway NFCom: "${situacao}" (normalizada: "${situacao.trim().toLowerCase()}")`,
		);
	}
	return mapeada;
}

/** Variação leniente: retorna `null` para situação desconhecida em vez de
 * lançar. Usada no `/api/lista` (heurística de inspeção) — um valor inesperado
 * do gateway não deve derrubar a reconciliação, apenas não casar. */
export function normalizarSituacaoLeniente(situacao: string): SituacaoNota | null {
	return MAPA[situacao.trim().toLowerCase()] ?? null;
}
