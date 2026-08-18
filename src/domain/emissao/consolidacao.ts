/**
 * Consolidação final da fatura (SPEC-0001 passo 5): o callback do parent do Flow
 * BullMQ deriva o estado final da fatura a partir dos resultados das cobranças e
 * notas:
 *
 * - `emitida` — tudo ok (boletos e notas).
 * - `parcial` — algum sucesso, algum erro.
 * - `erro` — tudo falhou.
 *
 * Caso 18: a emissão das notas **independe** do sucesso do boleto da cobrança (a
 * NFCom é obrigação fiscal do serviço). Um boleto falho com nota ok conta como
 * sucesso parcial, não erro — a fatura tende a `parcial`, não `erro`.
 */
import type { StatusFatura } from "#/domain/types";

/**
 * Fuso horário do domínio (CONVENTIONS.md m7): datas puras de domínio são
 * computadas em `America/Sao_Paulo`, nunca no fuso do container (UTC em
 * produção).
 */
export const FUSO_SP = "America/Sao_Paulo";

/**
 * Data pura de hoje (`YYYY-MM-DD`) no fuso do domínio (America/Sao_Paulo).
 * Usa `en-CA` (formato ISO YYYY-MM-DD) para evitar a máscara DD/MM/AAAA de
 * `pt-BR` e a dependência do fuso UTC do container (M9).
 */
export function hojeEmSP(): string {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: FUSO_SP,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(new Date());
}

export interface ResultadoCobranca {
	cobrancaId: number;
	boletoOk: boolean;
	notasOk: boolean[];
}

export interface ResultadoConsolidacao {
	status: StatusFatura;
}

/**
 * Consolida os resultados das cobranças no estado final da fatura.
 * `notasOk` é o array de sucesso/fracasso das notas da cobrança; `boletoOk` é o
 * resultado do boleto. A unidade de "sucesso" para consolidar é: boleto E notas.
 */
export function consolidarFatura(
	resultados: ResultadoCobranca[],
): ResultadoConsolidacao {
	if (resultados.length === 0) {
		// Edge teórico (m3): 0 cobranças = nada emitido ainda → `a-emitir`, não
		// `emitida` (nada foi emitido de fato). O caminho normal de 0 children é
		// tratado no worker (M3) sem passar por aqui.
		return { status: "a-emitir" };
	}
	// Uma cobrança é "totalmente ok" se boleto ok E todas as notas ok.
	const totalOk = (r: ResultadoCobranca) =>
		r.boletoOk && r.notasOk.length > 0 && r.notasOk.every((n) => n);

	const algumaOk = resultados.some(totalOk);
	const todasOk = resultados.every(totalOk);

	if (todasOk) return { status: "emitida" };
	if (algumaOk) return { status: "parcial" };
	// Nenhuma cobrança totalmente ok. Mas caso 18: notas podem ter ok mesmo com
	// boleto falho — isso é parcial (a nota emite), não erro.
	const algumaNotaOk = resultados.some(
		(r) => r.notasOk.length > 0 && r.notasOk.some((n) => n),
	);
	if (algumaNotaOk) return { status: "parcial" };
	// Nada ok nem de boleto nem de nota → erro (caso 10).
	return { status: "erro" };
}
