import { describe, expect, test } from "bun:test";
import { criarFaturasRoutes } from "#/http/routes/faturas.route";
import {
	fakeAtacado,
	fakeQueue,
	faturaAemitirFixture,
	CPF_VALIDO,
} from "../http/_helpers";

/**
 * SPEC-0001: POST /faturas/:id/emitir — casos 1 (409), 3 (soma), 4 (nota por
 * cobrança), 8 (doc inválido) + 202 + enfileira (não executa síncrono).
 *
 * A rota carrega a fatura via `getFaturaPorId` (extensão injetada).
 */
describe("POST /faturas/:id/emitir (SPEC-0001)", () => {
	function appCom(fatura: ReturnType<typeof faturaAemitirFixture>) {
		const queue = fakeQueue();
		const app = criarFaturasRoutes({
			atacado: fakeAtacado({ getFaturaPorId: async () => fatura } as any),
			queue,
		});
		return { app, queue };
	}

	test("happy path: 202 + jobId + statusUrl + enfileira", async () => {
		const { app, queue } = appCom(faturaAemitirFixture());
		const res = await app.request("/faturas/101/emitir", { method: "POST" });
		expect(res.status).toBe(202);
		const body = await res.json();
		expect(body.jobId).toBe("job-1");
		expect(body.statusUrl).toBe("/faturas/101/emissao");
		expect(queue.calls.length).toBe(1);
		expect(queue.calls[0].faturaId).toBe(101);
	});

	test("caso 1: fatura emitindo → 409", async () => {
		const { app, queue } = appCom(faturaAemitirFixture({ status: "emitindo" }));
		const res = await app.request("/faturas/101/emitir", { method: "POST" });
		expect(res.status).toBe(409);
		expect(queue.calls.length).toBe(0);
	});

	test("caso 1: fatura emitida → 409", async () => {
		const { app, queue } = appCom(faturaAemitirFixture({ status: "emitida" }));
		const res = await app.request("/faturas/101/emitir", { method: "POST" });
		expect(res.status).toBe(409);
	});

	test("fatura não encontrada → 404", async () => {
		const app = criarFaturasRoutes({
			atacado: fakeAtacado({ getFaturaPorId: async () => null } as any),
			queue: fakeQueue(),
		});
		const res = await app.request("/faturas/999/emitir", { method: "POST" });
		expect(res.status).toBe(404);
	});

	test("caso 3: soma das cobranças diverge do total → 422", async () => {
		const f = faturaAemitirFixture({ valorTotal: 9000 }); // cobrança é 10000
		const { app } = appCom(f);
		const res = await app.request("/faturas/101/emitir", { method: "POST" });
		expect(res.status).toBe(422);
		const body = await res.json();
		expect(body.erro.mensagem).toContain("diverge");
	});

	test("caso 4: cobrança sem nota a-emitir → 422", async () => {
		const f = faturaAemitirFixture();
		// marca a única nota como emitida
		f.cobrancas[0].notas[0].statusInterno = "emitida";
		const { app } = appCom(f);
		const res = await app.request("/faturas/101/emitir", { method: "POST" });
		expect(res.status).toBe(422);
		const body = await res.json();
		expect(body.erro.mensagem).toContain("nota a-emitir");
	});

	test("caso 8: documento do destinatário inválido → 422", async () => {
		const f = faturaAemitirFixture();
		f.cobrancas[0].notas[0].cpfcnpj = "11111111111";
		const { app } = appCom(f);
		const res = await app.request("/faturas/101/emitir", { method: "POST" });
		expect(res.status).toBe(422);
		const body = await res.json();
		expect(body.erro.mensagem).toContain("Documento");
	});
});
