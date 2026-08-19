/**
 * Self-test dos fakes de test/integration/helpers.ts: os métodos dos fakes são
 * arrow functions internas — o gate de funções por arquivo as conta como não
 * cobertas quando o flow.test.ts (skipIf sem Redis) não as exercita. Este
 * arquivo é puro (sem Redis) e garante a cobertura delas em qualquer ambiente.
 */
import { describe, expect, it } from "bun:test";
import {
	CHAVE_SEFAZ,
	montarFaturaArvore,
	criarFakeAtacado,
	criarFakeAsaas,
	criarFakeNfcom,
	redisDisponivel,
} from "./helpers";

describe("integration/helpers — fakes", () => {
	it("montarFaturaArvore: árvore completa + overrides de ids", () => {
		const f = montarFaturaArvore();
		expect(f.id).toBe(900);
		expect(f.cobrancas).toHaveLength(1);
		expect(f.cobrancas[0].id).toBe(901);
		expect(f.cobrancas[0].notas).toHaveLength(1);
		expect(f.cobrancas[0].notas[0].id).toBe(910);
		expect(f.cobrancas[0].notas[0].itens).toHaveLength(1);
		const custom = montarFaturaArvore(1, 2, 3);
		expect(custom.id).toBe(1);
		expect(custom.cobrancas[0].id).toBe(2);
		expect(custom.cobrancas[0].notas[0].id).toBe(3);
	});

	it("criarFakeAtacado: getFaturaPorId devolve a árvore para o id e null para outro", async () => {
		const fatura = montarFaturaArvore(500);
		const a = criarFakeAtacado(fatura);
		expect(await a.getFaturaPorId(500)).toBe(fatura);
		expect(await a.getFaturaPorId(999)).toBeNull();
	});

	it("criarFakeAsaas: customer novo + boleto ok (todos os métodos)", async () => {
		const asaas = criarFakeAsaas();
		expect(await asaas.buscarCustomerPorDocumento("111")).toBeNull();
		const criado = await asaas.criarCustomer({ name: "M", email: "m@x.com", cpfCnpj: "111" });
		expect(criado.id).toBe("cus_1");
		expect(criado.name).toBe("M");
		const atualizado = await asaas.atualizarCustomer("cus_1", { name: "M2" });
		expect(atualizado.name).toBe("M2");
		const boleto = await asaas.criarBoleto();
		expect(boleto.idExterno).toBe("bol_1");
		expect(await asaas.consultarBoletoPorExternalReference("bol_1")).toBeNull();
	});

	it("criarFakeNfcom: autorizada com chave/protocolo (todos os métodos)", async () => {
		const nfcom = criarFakeNfcom();
		expect(await nfcom.autenticar()).toBe("token");
		const nota = await nfcom.emitirNFCom();
		expect(nota.situacao).toBe("autorizada");
		expect(nota.chave).toBe(CHAVE_SEFAZ);
		expect(await nfcom.consultarLista()).toEqual([]);
	});

	it("redisDisponivel: porta inacessível → false (sem travar; exercita retryStrategy/catch)", async () => {
		// Porta sem listener → connect falha; retryStrategy: () => null impede
		// retry infinito e o catch converte para false. connectTimeout curto.
		const ok = await redisDisponivel("redis://127.0.0.1:6390");
		expect(ok).toBe(false);
	});
});
