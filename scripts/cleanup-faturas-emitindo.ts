/**
 * One-shot de remenda (2026-08-19): faturas órfãs em `emitindo` deixadas pelo
 * bug do parent do Flow (jobs pai failed antes do fix b2e8779).
 *
 * Reusa o caminho A2 do worker (`consolidarFaturaPorEstado`): deriva o status
 * do estado REAL das cobranças/notas, enfileira no outbox (o worker outbox do
 * app no ar aplica no NocoBase) e libera o lease do SQLite de coordenação.
 *
 * Uso (DENTRO do container — precisa do env + /app/data):
 *   bun /app/cleanup-faturas-emitindo.ts dry    # só deriva e imprime
 *   bun /app/cleanup-faturas-emitindo.ts apply  # consolida + libera lease
 */
import { env } from "#/env";
import { getDb } from "#/lib/db/client";
import { createRateLimiter, wrapWithRateLimit } from "#/lib/rate-limit";
import { createAtacadoClient } from "#/modules/atacado/atacado.client";
import { AtacadoRepository } from "#/modules/atacado/atacado.repository";
import { consolidarFaturaPorEstado } from "#/workers/emissao.worker";
import { enfileirarWebhook } from "#/workers/webhook.worker";
import { resultadosDaFatura, consolidarFatura } from "#/domain/emissao/consolidacao";
import type { EmissaoDeps } from "#/workers/emissao.worker";

const IDS = [
	381974092513280,
	381974425960448,
	381982518870016,
	381982711808000,
	381982906843136,
	381983900893184,
];

const modo = process.argv[2] ?? "dry";
if (modo !== "dry" && modo !== "apply") {
	console.error("uso: cleanup-faturas-emitindo.ts <dry|apply>");
	process.exit(2);
}

const atacado = wrapWithRateLimit(
	new AtacadoRepository(createAtacadoClient()),
	createRateLimiter(env.RATE_LIMIT_ATACADO),
);
const db = getDb();

// Deps mínimos p/ o caminho A2: atacado (estado real) + db (outbox/lease) +
// queue (webhook — espelha o que o worker real faria na consolidação).
const deps: EmissaoDeps = {
	atacado,
	// asaas/nfcom nunca são usados no caminho consolidarFaturaPorEstado.
	asaas: undefined!,
	nfcom: undefined!,
	db,
	queue: {
		async enfileirarEmissaoFatura() {
			throw new Error("enfileirarEmissaoFatura não usado neste script");
		},
		async enfileirarWebhook(evento) {
			await enfileirarWebhook(evento, { url: env.WEBHOOK_URL, secret: env.WEBHOOK_SECRET });
		},
	},
};

let aplicou = 0;
for (const id of IDS) {
	const fatura = await atacado.getFaturaPorId(id);
	if (!fatura) {
		console.log(`fatura ${id}: NÃO ENCONTRADA`);
		continue;
	}
	const resultados = resultadosDaFatura(fatura);
	const derivado = consolidarFatura(resultados);
	const detalhe = resultados
		.map((r) => `boleto:${r.boletoOk ? 1 : 0} notas:[${r.notasOk.map((n) => (n ? "1" : "0")).join("")}]`)
		.join(" | ");
	console.log(`fatura ${id}: atual=${fatura.status} → derivado=${derivado.status}  (${detalhe || "sem cobranças"})`);

	if (derivado.status === "a-emitir") {
		console.log(`  !! estado inesperado (sem cobranças definidas) — NÃO aplicar; investigar à mão`);
		continue;
	}
	if (modo === "apply") {
		await consolidarFaturaPorEstado({ data: { faturaId: id } } as never, deps);
		console.log(`  → consolidada p/ ${derivado.status} (outbox enfileirado + lease liberado)`);
		aplicou++;
	}
}
console.log(`\nmodo=${modo} — ${aplicou} fatura(s) consolidada(s)`);
