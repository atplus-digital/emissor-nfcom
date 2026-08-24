/**
 * Handler de aplicação de `POST /:id/emitir` (SPEC-0001 — enfileira, 202).
 *
 * Extraído da rota (ADR-0007 rota fina): aqui vive todo o gating de emissão —
 * carga da fatura (404), status emitindo/emitida (409), soma de cobranças
 * (422), nota a-emitir em toda cobrança (422), documento válido do
 * destinatário (422) e o enfileiramento na `QueuePort` (não executa
 * síncrono — ADR-0002).
 *
 * Compartilhado pela rota de API key (`faturas.route.ts`) e pela rota do
 * painel (`painel-data.route.ts`) — as duas chamam o mesmo helper (sem
 * divergência de comportamento). O `id` já chega validado pela rota
 * (inteiro > 0).
 */
import { documentoValido } from "#/domain/fatura/validacao";
import type { AtacadoPort } from "#/domain/ports/atacado.port";
import type { QueuePort } from "#/domain/ports/queue.port";
import { TipoErro, erroResponse } from "#/http/middlewares/envelope";

/** Resultado: corpo da resposta + status HTTP (2xx sucesso, 4xx/5xx erro). */
export interface EmitirResultado {
	corpo: unknown;
	status: number;
}

/** Monta o envelope e o status de um erro do gating. */
function erro(tipo: TipoErro, mensagem: string): EmitirResultado {
	const { corpo, status } = erroResponse(tipo, mensagem);
	return { corpo, status };
}

/**
 * Executa o enfileiramento de emissão de uma fatura. Cada gate mapeia para
 * seu envelope; no sucesso, enfileira e responde 202 com `{ jobId, statusUrl }`
 * (a URL aponta para `GET /faturas/:id/emissao` da API key — o front do
 * painel sonda o equivalente do painel com os mesmos dados).
 */
export async function emitirFatura(
	atacado: AtacadoPort,
	queue: QueuePort,
	id: number,
): Promise<EmitirResultado> {
	// Carrega a fatura (árvore). Não encontrada → 404.
	const fatura = await atacado.getFaturaPorId(id);
	if (!fatura) {
		return erro(TipoErro.NAO_ENCONTRADO, "Fatura não encontrada");
	}

	// Caso 1: 409 se emitindo/emitida.
	if (fatura.status === "emitindo" || fatura.status === "emitida") {
		return erro(TipoErro.CONFLITO, "Emissão já em curso ou concluída");
	}

	// Caso 3: soma das cobranças == total da fatura (até 1 centavo).
	const soma = fatura.cobrancas.reduce((acc, cb) => acc + cb.valorTotal, 0);
	if (Math.abs(soma - fatura.valorTotal) > 1) {
		return erro(TipoErro.VALIDACAO, "Soma das cobranças diverge do total da fatura");
	}

	// Caso 4: toda cobrança tem ≥1 nota a-emitir.
	const semNota = fatura.cobrancas.find((cb) => !cb.notas.some((n) => n.statusInterno === "a-emitir"));
	if (semNota) {
		return erro(TipoErro.VALIDACAO, "Toda cobrança precisa de nota a-emitir");
	}

	// Caso 8: documentos válidos (destinatários).
	const notas = fatura.cobrancas.flatMap((cb) => cb.notas);
	const docInvalido = notas.find((n) => !documentoValido(n.cpfcnpj));
	if (docInvalido) {
		return erro(TipoErro.VALIDACAO, `Documento do destinatário inválido: ${docInvalido.nome}`);
	}

	// Enfileira (não executa síncrono — ADR-0002). O worker carrega a fatura
	// por `getFaturaPorId` — o job leva só o id.
	const { jobId } = await queue.enfileirarEmissaoFatura(id);
	return { corpo: { jobId, statusUrl: `/faturas/${id}/emissao` }, status: 202 };
}
