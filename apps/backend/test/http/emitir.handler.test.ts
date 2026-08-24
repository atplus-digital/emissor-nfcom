/**
 * Handler de aplicação `emitirFatura` — `src/http/routes/emitir.handler.ts`.
 *
 * Gating extraído da rota (compartilhado entre a rota de API key e a do
 * painel): 404 (fatura inexistente), 409 (emitindo/emitida), 422 (soma
 * divergente / cobrança sem nota a-emitir / documento inválido), 202
 * (enfileira na QueuePort).
 */
import { describe, expect, test } from "bun:test";
import { emitirFatura } from "#/http/routes/emitir.handler";
import { fakeAtacado, fakeQueue, faturaAemitirFixture } from "./_helpers";

/** Lê o envelope de erro do resultado (apenas p/ os casos de gating). */
function corpoErro(resultado: { corpo: unknown; status: number }): { tipo: string; mensagem: string } {
	return (resultado.corpo as { erro: { tipo: string; mensagem: string } }).erro;
}

describe("emitirFatura (gating)", () => {
	test("fatura inexistente → 404 NAO_ENCONTRADO", async () => {
		const atacado = fakeAtacado({ getFaturaPorId: async () => null } as any);
		const r = await emitirFatura(atacado, fakeQueue(), 999);
		expect(r.status).toBe(404);
		expect(corpoErro(r).tipo).toBe("NAO_ENCONTRADO");
	});

	test("status emitindo → 409 CONFLITO", async () => {
		const atacado = fakeAtacado({
			getFaturaPorId: async () => faturaAemitirFixture({ status: "emitindo" }),
		} as any);
		const r = await emitirFatura(atacado, fakeQueue(), 101);
		expect(r.status).toBe(409);
		expect(corpoErro(r).tipo).toBe("CONFLITO");
	});

	test("status emitida → 409 CONFLITO", async () => {
		const atacado = fakeAtacado({
			getFaturaPorId: async () => faturaAemitirFixture({ status: "emitida" }),
		} as any);
		const r = await emitirFatura(atacado, fakeQueue(), 101);
		expect(r.status).toBe(409);
		expect(corpoErro(r).tipo).toBe("CONFLITO");
	});

	test("soma das cobranças diverge do total (2 centavos) → 422 VALIDACAO", async () => {
		const f = faturaAemitirFixture(); // fatura 10000 / cobrança 10000
		f.cobrancas[0].valorTotal = 9998; // diverge 2 > 1 centavo
		const atacado = fakeAtacado({ getFaturaPorId: async () => f } as any);
		const r = await emitirFatura(atacado, fakeQueue(), 101);
		expect(r.status).toBe(422);
		expect(corpoErro(r).tipo).toBe("VALIDACAO");
		expect(corpoErro(r).mensagem).toMatch(/soma/i);
	});

	test("divergência de 1 centavo → tolerada (não bloqueia)", async () => {
		const f = faturaAemitirFixture();
		f.cobrancas[0].valorTotal = 9999; // diverge 1 — dentro da tolerância
		const atacado = fakeAtacado({ getFaturaPorId: async () => f } as any);
		const queue = fakeQueue();
		const r = await emitirFatura(atacado, queue, 101);
		expect(r.status).toBe(202);
		expect(queue.calls).toEqual([{ faturaId: 101 }]);
	});

	test("cobrança sem nota a-emitir → 422 VALIDACAO", async () => {
		const f = faturaAemitirFixture();
		f.cobrancas[0].notas[0].statusInterno = "emitida";
		const atacado = fakeAtacado({ getFaturaPorId: async () => f } as any);
		const r = await emitirFatura(atacado, fakeQueue(), 101);
		expect(r.status).toBe(422);
		expect(corpoErro(r).tipo).toBe("VALIDACAO");
		expect(corpoErro(r).mensagem).toMatch(/nota a-emitir/);
	});

	test("documento do destinatário inválido → 422 VALIDACAO (com nome)", async () => {
		const f = faturaAemitirFixture();
		f.cobrancas[0].notas[0].cpfcnpj = "123"; // não é CPF/CNPJ
		const atacado = fakeAtacado({ getFaturaPorId: async () => f } as any);
		const r = await emitirFatura(atacado, fakeQueue(), 101);
		expect(r.status).toBe(422);
		expect(corpoErro(r).tipo).toBe("VALIDACAO");
		expect(corpoErro(r).mensagem).toContain("Cliente Final");
	});

	test("sucesso → 202 { jobId, statusUrl } e enfileira o id", async () => {
		const f = faturaAemitirFixture();
		const atacado = fakeAtacado({ getFaturaPorId: async () => f } as any);
		const queue = fakeQueue();
		const r = await emitirFatura(atacado, queue, 101);
		expect(r.status).toBe(202);
		expect(r.corpo).toEqual({ jobId: "job-1", statusUrl: "/faturas/101/emissao" });
		expect(queue.calls).toEqual([{ faturaId: 101 }]);
	});
});
