/**
 * AtacadoRepository.listarFaturas (painel — painel de visualização).
 *
 * Contrato:
 * - `client.list(t_nfcom_faturas, { filter, appends: ["f_cobrancas"] })`.
 * - Filter montado **só com os campos presentes** no filtro (parceiroId,
 *   dataReferencia, status).
 * - Mapeia para `FaturaResumo` (centavos inteiros via realToCents;
 *   cobrancasCount = tamanho de `f_cobrancas`).
 * - 404 do Atacado (list sem registros) → `[]` (mesmo padrão das demais
 *   listas do repositório).
 */
import { describe, expect, it, mock } from "bun:test";
import { AtacadoError, type AtacadoClient } from "#/modules/atacado/atacado.client";
import { AtacadoRepository } from "#/modules/atacado/atacado.repository";

/** Mock do AtacadoClient com spies registrando as chamadas (mesmo padrão de repository.test.ts). */
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

/** Linha externa de fatura (t_nfcom_faturas) com uma cobrança appendada. */
const LINHA_FATURA = {
	id: 101,
	f_fk_parceiro: 42,
	f_data_referencia: "2026-08-01",
	f_data_vencimento: "2026-09-10",
	f_valor_total: 123.45,
	f_tipo_de_faturamento: "cofaturamento",
	f_status: "a-emitir",
	f_cobrancas: [
		{
			id: 456,
			f_fk_fatura: 101,
			f_valor_total: 61.73,
			f_nome_devedor: "Parceiro Ltda",
			f_documento_devedor: "11.444.777/0001-61",
			f_email_devedor: "fin@parceiro.com",
			f_status: "a-emitir",
			f_data_vencimento: "2026-09-10",
			f_id_externo: "",
			f_link_fatura: "",
			f_data_emissao: "",
		},
		{
			id: 457,
			f_fk_fatura: 101,
			f_valor_total: 61.72,
			f_nome_devedor: "Parceiro Ltda",
			f_documento_devedor: "11.444.777/0001-61",
			f_email_devedor: "fin@parceiro.com",
			f_status: "a-emitir",
			f_data_vencimento: "2026-09-10",
			f_id_externo: "",
			f_link_fatura: "",
			f_data_emissao: "",
		},
	],
};

describe("AtacadoRepository > listarFaturas", () => {
	it("filtro completo → filter com os 3 campos f_* + appends f_cobrancas", async () => {
		const { client, calls } = mockClient({ list: async () => [LINHA_FATURA] });
		const repo = new AtacadoRepository(client);
		await repo.listarFaturas({
			parceiroId: 42,
			dataReferencia: "2026-08-01",
			status: "a-emitir",
		});
		expect(calls.list[0][0]).toBe("t_nfcom_faturas");
		const query = calls.list[0][1] as { filter: Record<string, unknown>; appends: string[] };
		expect(query.filter).toEqual({
			f_fk_parceiro: 42,
			f_data_referencia: "2026-08-01",
			f_status: "a-emitir",
		});
		expect(query.appends).toEqual(["f_cobrancas"]);
	});

	it("filtro parcial (só status) → filter só com o campo presente", async () => {
		const { client, calls } = mockClient({ list: async () => [] });
		const repo = new AtacadoRepository(client);
		await repo.listarFaturas({ status: "erro" });
		const query = calls.list[0][1] as { filter: Record<string, unknown> };
		expect(query.filter).toEqual({ f_status: "erro" });
	});

	it("filtro parcial (só dataReferencia) → filter só com f_data_referencia", async () => {
		const { client, calls } = mockClient({ list: async () => [] });
		const repo = new AtacadoRepository(client);
		await repo.listarFaturas({ dataReferencia: "2026-08-01" });
		const query = calls.list[0][1] as { filter: Record<string, unknown> };
		expect(query.filter).toEqual({ f_data_referencia: "2026-08-01" });
	});

	it("sem filtro → filter vazio", async () => {
		const { client, calls } = mockClient({ list: async () => [] });
		const repo = new AtacadoRepository(client);
		await repo.listarFaturas({});
		const query = calls.list[0][1] as { filter: Record<string, unknown> };
		expect(query.filter).toEqual({});
	});

	it("mapeia p/ FaturaResumo: valorTotal via realToCents e cobrancasCount = |f_cobrancas|", async () => {
		const { client } = mockClient({ list: async () => [LINHA_FATURA] });
		const repo = new AtacadoRepository(client);
		const resumos = await repo.listarFaturas({});
		expect(resumos).toHaveLength(1);
		const r = resumos[0];
		expect(r.id).toBe(101);
		expect(r.parceiroId).toBe(42);
		expect(r.dataReferencia).toBe("2026-08-01");
		expect(r.dataVencimento).toBe("2026-09-10");
		expect(r.valorTotal).toBe(12345);
		expect(r.tipoFaturamento).toBe("cofaturamento");
		expect(r.status).toBe("a-emitir");
		expect(r.cobrancasCount).toBe(2);
	});

	it("fatura sem f_cobrancas → cobrancasCount 0", async () => {
		const { client } = mockClient({
			list: async () => [{ ...LINHA_FATURA, f_cobrancas: undefined }],
		});
		const repo = new AtacadoRepository(client);
		const resumos = await repo.listarFaturas({});
		expect(resumos[0].cobrancasCount).toBe(0);
	});

	it("404 do client → [] (NocoBase responde 404 em list sem registros)", async () => {
		const { client } = mockClient({
			list: async () => {
				throw new AtacadoError("Atacado 404", 404, "Not Found");
			},
		});
		const repo = new AtacadoRepository(client);
		expect(await repo.listarFaturas({})).toEqual([]);
	});

	it("propaga erro não-404 (ex.: 500)", async () => {
		const { client } = mockClient({
			list: async () => {
				throw new AtacadoError("Atacado 500", 500, "boom");
			},
		});
		const repo = new AtacadoRepository(client);
		await expect(repo.listarFaturas({})).rejects.toBeInstanceOf(AtacadoError);
	});
});
