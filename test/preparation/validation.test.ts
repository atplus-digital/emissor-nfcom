import { describe, expect, test } from "bun:test";
import { criarFaturasRoutes } from "#/http/routes/faturas.route";
import {
	fakeAtacado,
	fakeQueue,
	clienteFixture,
	parceiroFixture,
	planoFixture,
	CPF_VALIDO,
} from "../http/_helpers";

/**
 * SPEC-0002 validação pré-persistência: casos 1 (parceiro), 2 (clientes c/ linhas),
 * 3 (planos), 4 (doc dígito), 13 (endereço incompleto). Todos 422.
 */
describe("POST /faturas/preparar — validação (SPEC-0002 casos 1,2,3,4,13)", () => {
	test("caso 1: parceiro não encontrado → 422", async () => {
		const app = criarFaturasRoutes({
			atacado: fakeAtacado({ buscarParceiroPorId: async () => null as any }),
			queue: fakeQueue(),
		});
		const res = await app.request("/faturas/preparar", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ parceiroId: 99, dataReferencia: "2026-08-01", tipoFaturamento: "parceiro" }),
		});
		expect(res.status).toBe(422);
		const body = await res.json();
		expect(body.erro.mensagem).toContain("Parceiro");
	});

	test("caso 2: nenhum cliente com linhas ativas → 422", async () => {
		const app = criarFaturasRoutes({
			atacado: fakeAtacado({ buscarClientesAtivosPorParceiro: async () => [] }),
			queue: fakeQueue(),
		});
		const res = await app.request("/faturas/preparar", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ parceiroId: 42, dataReferencia: "2026-08-01", tipoFaturamento: "parceiro" }),
		});
		expect(res.status).toBe(422);
		const body = await res.json();
		expect(body.erro.mensagem).toContain("linhas ativas");
	});

	test("caso 2: cliente com linha de plano inexistente/preço zero → descartado, 422 se todos", async () => {
		const cli = clienteFixture({ linhas: [{ planoId: 999, descricao: "x", unitario: 10000, quantidade: 1 }] });
		const app = criarFaturasRoutes({
			atacado: fakeAtacado({ buscarClientesAtivosPorParceiro: async () => [cli] }),
			queue: fakeQueue(),
		});
		const res = await app.request("/faturas/preparar", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ parceiroId: 42, dataReferencia: "2026-08-01", tipoFaturamento: "parceiro" }),
		});
		expect(res.status).toBe(422);
	});

	test("caso 3: planos inexistentes → 422", async () => {
		const app = criarFaturasRoutes({
			atacado: fakeAtacado({ buscarPlanosDeServico: async () => [] }),
			queue: fakeQueue(),
		});
		const res = await app.request("/faturas/preparar", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ parceiroId: 42, dataReferencia: "2026-08-01", tipoFaturamento: "parceiro" }),
		});
		expect(res.status).toBe(422);
		const body = await res.json();
		expect(body.erro.mensagem).toContain("Planos");
	});

	test("caso 4: documento do destinatário inválido → 422", async () => {
		const cli = clienteFixture({ cpfcnpj: "11111111111" });
		const app = criarFaturasRoutes({
			atacado: fakeAtacado({ buscarClientesAtivosPorParceiro: async () => [cli] }),
			queue: fakeQueue(),
		});
		const res = await app.request("/faturas/preparar", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ parceiroId: 42, dataReferencia: "2026-08-01", tipoFaturamento: "cliente-final" }),
		});
		expect(res.status).toBe(422);
		const body = await res.json();
		expect(body.erro.mensagem).toContain("Documento");
	});

	test("caso 13: endereço incompleto do destinatário → 422", async () => {
		const cli = clienteFixture({
			endereco: { logradouro: "Rua", numero: "", bairro: "B", cep: "80000000", cidade: "Curitiba", uf: "PR" },
		});
		const app = criarFaturasRoutes({
			atacado: fakeAtacado({ buscarClientesAtivosPorParceiro: async () => [cli] }),
			queue: fakeQueue(),
		});
		const res = await app.request("/faturas/preparar", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ parceiroId: 42, dataReferencia: "2026-08-01", tipoFaturamento: "cliente-final" }),
		});
		expect(res.status).toBe(422);
		const body = await res.json();
		expect(body.erro.mensagem).toContain("endereço");
	});
});
