import { describe, expect, test } from "bun:test";
import { criarFaturasRoutes } from "#/http/routes/faturas.route";
import { fakeAtacado, fakeQueue } from "../http/_helpers";

/**
 * SPEC-0002 caso 8: body inválido (tipoFaturamento fora do enum, dataReferencia
 * inválida, ou parceiroId ≤ 0) → 422 VALIDACAO (Zod).
 */
describe("POST /faturas/preparar — schema (SPEC-0002 caso 8)", () => {
	test("parceiroId ≤ 0 → 422", async () => {
		const app = criarFaturasRoutes({ atacado: fakeAtacado(), queue: fakeQueue() });
		const res = await app.request("/faturas/preparar", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ parceiroId: 0, dataReferencia: "2026-08-01", tipoFaturamento: "parceiro" }),
		});
		expect(res.status).toBe(422);
		const body = await res.json();
		expect(body.erro.tipo).toBe("VALIDACAO");
	});

	test("dataReferencia inválida → 422", async () => {
		const app = criarFaturasRoutes({ atacado: fakeAtacado(), queue: fakeQueue() });
		const res = await app.request("/faturas/preparar", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ parceiroId: 42, dataReferencia: "nao-e-data", tipoFaturamento: "parceiro" }),
		});
		expect(res.status).toBe(422);
	});

	test("tipoFaturamento fora do enum → 422", async () => {
		const app = criarFaturasRoutes({ atacado: fakeAtacado(), queue: fakeQueue() });
		const res = await app.request("/faturas/preparar", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ parceiroId: 42, dataReferencia: "2026-08-01", tipoFaturamento: "outro" }),
		});
		expect(res.status).toBe(422);
	});
});
