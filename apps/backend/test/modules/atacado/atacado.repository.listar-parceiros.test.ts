/**
 * AtacadoRepository.listarParceiros (painel — seletor de nova fatura).
 *
 * Contrato:
 * - `client.list(t_parceiros, {})` (sem filter — lista todos).
 * - Mapeia p/ `ParceiroResumo` inline (SEM parceiroToDomain — a lista não
 *   monta endereço): `id`, `f_razao_social`, `f_fantasia`,
 *   `desmascararDoc(f_cnpj)` (CNPJ limpo no domínio; a máscara é só na UI).
 * - 404 do Atacado (list sem registros) → `[]` (mesmo padrão de listarFaturas).
 */
import { describe, expect, it, mock } from "bun:test";
import { AtacadoError, type AtacadoClient } from "#/modules/atacado/atacado.client";
import { AtacadoRepository } from "#/modules/atacado/atacado.repository";

/** Mock do AtacadoClient com spies registrando as chamadas (mesmo padrão de *.listar.test.ts). */
function mockClient(
	impls: Partial<Record<keyof AtacadoClient, (...args: any[]) => any>> = {},
): {
	client: AtacadoClient;
	calls: Record<string, unknown[][]>;
} {
	const calls: Record<string, unknown[][]> = {};
	const make = (name: keyof AtacadoClient) =>
		mock((...args: unknown[]) => {
			(calls[name] ??= []).push(args);
			return impls[name]?.(...args);
		});
	const client = {
		get: make("get"),
		list: make("list"),
		create: make("create"),
		destroy: make("destroy"),
		update: make("update"),
	} as unknown as AtacadoClient;
	return { client, calls };
}

/** Linha externa de parceiro (t_parceiros) — CNPJ mascarado como o CRM entrega. */
const LINHA_PARCEIRO = {
	id: 42,
	f_razao_social: "Parceiro Ltda",
	f_fantasia: "Parceiro",
	f_cnpj: "11.444.777/0001-61",
	f_email_faturamento: "fin@parceiro.com",
	f_data_vencimento: 10,
	f_endereco: "Rua Exemplo",
	f_numero: "123",
	f_bairro: "Centro",
	f_cep: "80000000",
	f_cidade: "Curitiba",
	f_uf: "PR",
	f_ie: "123",
};

describe("AtacadoRepository > listarParceiros", () => {
	it("chama client.list com t_parceiros e query vazia (sem filter)", async () => {
		const { client, calls } = mockClient({ list: async () => [LINHA_PARCEIRO] });
		const repo = new AtacadoRepository(client);
		await repo.listarParceiros();
		expect(calls.list[0][0]).toBe("t_parceiros");
		expect(calls.list[0][1]).toEqual({});
	});

	it("mapeia p/ ParceiroResumo: id/razaoSocial/fantasia + cnpj desmascarado", async () => {
		const { client } = mockClient({ list: async () => [LINHA_PARCEIRO] });
		const repo = new AtacadoRepository(client);
		const resumos = await repo.listarParceiros();
		expect(resumos).toEqual([
			{
				id: 42,
				razaoSocial: "Parceiro Ltda",
				fantasia: "Parceiro",
				cnpj: "11444777000161", // desmascararDoc("11.444.777/0001-61")
			},
		]);
	});

	it("parceiro sem f_fantasia → fantasia undefined (não quebra o mapeamento)", async () => {
		const { client } = mockClient({
			list: async () => [{ ...LINHA_PARCEIRO, f_fantasia: undefined }],
		});
		const repo = new AtacadoRepository(client);
		const [r] = await repo.listarParceiros();
		expect(r.fantasia).toBeUndefined();
		expect(r.razaoSocial).toBe("Parceiro Ltda");
	});

	it("lista vazia → []", async () => {
		const { client } = mockClient({ list: async () => [] });
		const repo = new AtacadoRepository(client);
		expect(await repo.listarParceiros()).toEqual([]);
	});

	it("404 do client → [] (NocoBase responde 404 em list sem registros)", async () => {
		const { client } = mockClient({
			list: async () => {
				throw new AtacadoError("Atacado 404", 404, "Not Found");
			},
		});
		const repo = new AtacadoRepository(client);
		expect(await repo.listarParceiros()).toEqual([]);
	});

	it("propaga erro não-404 (ex.: 500)", async () => {
		const { client } = mockClient({
			list: async () => {
				throw new AtacadoError("Atacado 500", 500, "boom");
			},
		});
		const repo = new AtacadoRepository(client);
		await expect(repo.listarParceiros()).rejects.toBeInstanceOf(AtacadoError);
	});
});
