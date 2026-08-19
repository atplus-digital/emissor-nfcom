import { describe, expect, it, mock } from "bun:test";
import { AtacadoError, type AtacadoClient } from "#/modules/atacado/atacado.client";
import { AtacadoRepository } from "#/modules/atacado/atacado.repository";

/** Constrói um mock do AtacadoClient com spies registrando as chamadas. */
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

describe("AtacadoRepository > leitura", () => {
	it("buscarParceiroPorId: GET t_parceiros:get por filterByTk + appends", async () => {
		const { client, calls } = mockClient({
			get: async () => ({
				id: 42,
				f_razao_social: "P Ltda",
				f_cnpj: "12.345.678/0001-99",
				f_email_faturamento: "p@p.com",
				f_data_vencimento: 10,
				f_endereco: "r",
				f_numero: "1",
				f_bairro: "b",
				f_cep: "c",
				f_cidade: "ct",
				f_uf: "PR",
			}),
		});
		const repo = new AtacadoRepository(client);
		const p = await repo.buscarParceiroPorId(42);
		expect(p.id).toBe(42);
		expect(p.cnpj).toBe("12345678000199");
		expect(calls.get[0]).toMatchObject([expect.any(String), expect.objectContaining({ filterByTk: 42 })]);
	});

	it("buscarClientesAtivosPorParceiro: list t_clientes por f_fk_parceiro + appends linhas_fixas", async () => {
		const { client, calls } = mockClient({
			list: async () => [
				{
					id: 7,
					f_nome_razao: "C",
					f_cpf_cnpj: "111.222.333-44",
					f_email: "",
					f_endereco: "r",
					f_numero: "1",
					f_bairro: "b",
					f_cep: "c",
					f_cidade: "ct",
					f_uf: "PR",
					f_linhas_fixas: [],
				},
			],
		});
		const repo = new AtacadoRepository(client);
		const cs = await repo.buscarClientesAtivosPorParceiro(42);
		expect(cs).toHaveLength(1);
		expect(cs[0].cpfcnpj).toBe("11122233344");
		expect(calls.list[0]).toMatchObject([expect.any(String), expect.objectContaining({})]);
	});
});

describe("AtacadoRepository > criação da árvore", () => {
	it("criarFatura: POST :create e retorna {id}", async () => {
		const { client, calls } = mockClient({
			create: async () => ({ id: 101 }),
		});
		const repo = new AtacadoRepository(client);
		const r = await repo.criarFatura({
			parceiroId: 42,
			dataReferencia: "2026-08-01",
			dataVencimento: "2026-09-10",
			valorTotal: 12345,
			tipoFaturamento: "cofaturamento",
			status: "a-emitir",
		});
		expect(r).toEqual({ id: 101 });
		expect(calls.create[0][0]).toContain("t_nfcom_faturas");
		expect(calls.create[0][1]).toMatchObject({ f_status: "a-emitir" });
	});

	it("criarCobranca: cria na coleção correta com f_fk_fatura", async () => {
		const { client, calls } = mockClient({
			create: async () => ({ id: 456 }),
		});
		const repo = new AtacadoRepository(client);
		const r = await repo.criarCobranca(101, {
			valorTotal: 12345,
			nomeDevedor: "X",
			documentoDevedor: "12345678000199",
			emailDevedor: "x@x.com",
			status: "a-emitir",
			dataVencimento: "2026-09-10",
		});
		expect(r).toEqual({ id: 456 });
		// NocoBase exige o nome da relação belongsTo (`f_fatura`), não a FK
		// direta — `f_fk_fatura` é rejeitado com "Fatura is required".
		expect(calls.create[0][1]).toMatchObject({ f_fatura: 101, f_valor_total: 123.45 });
	});

	it("criarNota: cria com f_fk_cobranca", async () => {
		const { client, calls } = mockClient({
			create: async () => ({ id: 7 }),
		});
		const repo = new AtacadoRepository(client);
		const r = await repo.criarNota(456, {
			nome: "C",
			cpfcnpj: "11122233344",
			endereco: { logradouro: "r", numero: "1", bairro: "b", cep: "c", cidade: "ct", uf: "PR" },
			uf: "PR",
			cidade: "ct",
			statusInterno: "a-emitir",
			total: 12345,
		});
		expect(r).toEqual({ id: 7 });
		// NocoBase exige o nome da relação (`f_cobranca`), não a FK `f_fk_cobranca`.
		expect(calls.create[0][1]).toMatchObject({ f_cobranca: 456 });
	});

	it("criarItem: cria na t_nfcom_itens", async () => {
		const { client, calls } = mockClient({
			create: async () => ({ id: 1 }),
		});
		const repo = new AtacadoRepository(client);
		await repo.criarItem(7, {
			descricao: "S",
			cfop: "6102",
			cclass: "0001",
			quantidade: 1,
			unitario: 9990,
			total: 9990,
			aliqIcms: 0.18,
			bcIcms: 9990,
			icms: 1798,
			incideAliquota: true,
		});
		// NocoBase: nome da relação (`f_nota_fiscal`), não a FK `f_fk_nota_fiscal`.
		expect(calls.create[0][1]).toMatchObject({ f_nota_fiscal: 7, f_cfop: "6102" });
	});
});

describe("AtacadoRepository > removerArvore", () => {
	it("ordem: itens → notas → cobranças (não remove a fatura)", async () => {
		const calls: string[] = [];
		const { client } = mockClient({
			// removerArvore usa :get (não :list) — filterByTk é ignorado em :list
			// no NocoBase, o que faria remover a árvore da primeira fatura da lista.
			get: async () => ({
				id: 1,
				f_cobrancas: [
					{
						id: 50,
						f_notas_fiscais: [{ id: 11, f_nota_itens: [{ id: 21 }] }],
					},
				],
			}),
			destroy: async (_col: string, id: number) => {
				calls.push(`${_col}:${id}`);
			},
		});
		const repo = new AtacadoRepository(client);
		await repo.removerArvore(1);
		// espera que destrua itens antes de notas, notas antes de cobranças
		const itemIdx = calls.findIndex((c) => c.startsWith("t_nfcom_itens"));
		const notaIdx = calls.findIndex((c) => c.startsWith("t_nfcom_notas"));
		const cobIdx = calls.findIndex((c) => c.startsWith("t_nfcom_cobrancas"));
		expect(itemIdx).toBeGreaterThanOrEqual(0);
		expect(itemIdx).toBeLessThan(notaIdx);
		expect(notaIdx).toBeLessThan(cobIdx);
		// fatura NÃO é destruída
		expect(calls.find((c) => c.startsWith("t_nfcom_faturas"))).toBeUndefined();
	});

	it("usa :get (não :list) com filterByTk — :list ignora filterByTk no NocoBase", async () => {
		// Regressão: removerArvore antes usava list({filterByTk}), mas :list
		// ignora filterByTk e retorna todas as faturas — pegava [0] e removia a
		// árvore da fatura errada (ou nenhuma, se a primeira não tinha cobranças).
		const { client, calls } = mockClient({
			get: async () => ({ id: 5, f_cobrancas: [] }),
			list: async () => [{ id: 999, f_cobrancas: [{ id: 1 }] }],
		});
		const repo = new AtacadoRepository(client);
		await repo.removerArvore(5);
		// chamou get com filterByTk=5, NÃO chamou list
		expect(calls.get[0]).toMatchObject(["t_nfcom_faturas", expect.objectContaining({ filterByTk: 5 })]);
		expect(calls.list).toBeUndefined();
	});
});

describe("AtacadoRepository > atualização de estado", () => {
	it("atualizarStatusFatura: update na t_nfcom_faturas", async () => {
		const { client, calls } = mockClient({
			update: async () => undefined,
		});
		const repo = new AtacadoRepository(client);
		await repo.atualizarStatusFatura(101, "emitindo");
		expect(calls.update[0][0]).toContain("t_nfcom_faturas");
		expect(calls.update[0]).toMatchObject([expect.any(String), 101, { f_status: "emitindo" }]);
	});

	it("atualizarStatusCobranca: update com extras (idExterno, link, dataEmissao)", async () => {
		const { client, calls } = mockClient({
			update: async () => undefined,
		});
		const repo = new AtacadoRepository(client);
		await repo.atualizarStatusCobranca(456, "emitida", {
			idExterno: "ext_1",
			linkFatura: "http://l",
			dataEmissao: "2026-08-17",
		});
		expect(calls.update[0]).toMatchObject([
			expect.any(String),
			456,
			{ f_status: "emitida", f_id_externo: "ext_1", f_link_fatura: "http://l", f_data_emissao: "2026-08-17" },
		]);
	});

	it("atualizarStatusNota: update com chave/protocolo/etc", async () => {
		const { client, calls } = mockClient({
			update: async () => undefined,
		});
		const repo = new AtacadoRepository(client);
		await repo.atualizarStatusNota(7, {
			statusInterno: "emitida",
			situacao: "autorizada",
			chave: "chave44",
			protocolo: "prot",
			numero: 123,
			serie: 1,
		});
		expect(calls.update[0]).toMatchObject([
			expect.any(String),
			7,
			{ f_status_interno: "emitida", f_situacao: "autorizada", f_chave: "chave44" },
		]);
	});

	it("registrarErro: create na t_nfcom_erros", async () => {
		const { client, calls } = mockClient({
			create: async () => ({ id: 1 }),
		});
		const repo = new AtacadoRepository(client);
		await repo.registrarErro({
			cobrancaId: 456,
			erro: "Timeout NFCom",
			mensagem: "timeout",
			statusCode: "504",
		});
		expect(calls.create[0][0]).toContain("t_nfcom_erros");
		expect(calls.create[0][1]).toMatchObject({
			f_fk_cobranca: 456,
			f_erro: "Timeout NFCom",
			f_mensagem: "timeout",
			f_status_code: "504",
		});
	});
});

describe("AtacadoRepository > buscarParceiroPorId — 404 → null", () => {
	it("retorna null quando o Atacado responde 404 (registro não encontrado)", async () => {
		const { client } = mockClient({
			get: async () => {
				throw new AtacadoError("Atacado 404", 404, "not found");
			},
		});
		const repo = new AtacadoRepository(client);
		const p = await repo.buscarParceiroPorId(999);
		expect(p).toBeNull();
	});

	it("propaga erro não-404 (ex.: 500)", async () => {
		const { client } = mockClient({
			get: async () => {
				throw new AtacadoError("Atacado 500", 500, "boom");
			},
		});
		const repo = new AtacadoRepository(client);
		await expect(repo.buscarParceiroPorId(1)).rejects.toBeInstanceOf(AtacadoError);
	});
});

describe("AtacadoRepository > buscarClientesAtivosPorParceiro — 404 → []", () => {
	it("retorna [] quando o Atacado responde 404 em list (nenhum cliente do parceiro)", async () => {
		const { client } = mockClient({
			list: async () => {
				// NocoBase responde 404 quando o filtro não acha registros
				throw new AtacadoError("Atacado 404", 404, "Not Found");
			},
		});
		const repo = new AtacadoRepository(client);
		const cs = await repo.buscarClientesAtivosPorParceiro(999);
		expect(cs).toEqual([]);
	});

	it("propaga erro não-404 (ex.: 500)", async () => {
		const { client } = mockClient({
			list: async () => {
				throw new AtacadoError("Atacado 500", 500, "boom");
			},
		});
		const repo = new AtacadoRepository(client);
		await expect(repo.buscarClientesAtivosPorParceiro(1)).rejects.toBeInstanceOf(AtacadoError);
	});
});

describe("AtacadoRepository > buscarPlanosDeServico", () => {
	it("mapeia t_planos_de_servico p/ Plano (preço em centavos)", async () => {
		const { client, calls } = mockClient({
			list: async () => [
				{ id: 1, f_nome: "Internet 500MB", f_assinatura_mensal: 99.9 },
				{ id: 2, f_nome: "Voz", f_assinatura_mensal: 25.5 },
			],
		});
		const repo = new AtacadoRepository(client);
		const planos = await repo.buscarPlanosDeServico();
		expect(planos).toEqual([
			{ id: 1, descricao: "Internet 500MB", preco: 9990 },
			{ id: 2, descricao: "Voz", preco: 2550 },
		]);
		expect(calls.list[0][0]).toContain("t_planos");
	});
});

describe("AtacadoRepository > getFaturaPorId", () => {
	it("retorna Fatura (get :get com appends da árvore)", async () => {
		const { client, calls } = mockClient({
			get: async () => ({
				id: 101,
				f_fk_parceiro: 42,
				f_data_referencia: "2026-08-01",
				f_data_vencimento: "2026-09-10",
				f_valor_total: 123.45,
				f_tipo_de_faturamento: "cofaturamento",
				f_status: "a-emitir",
				f_cobrancas: [],
			}),
		});
		const repo = new AtacadoRepository(client);
		const f = await repo.getFaturaPorId(101);
		expect(f!.id).toBe(101);
		expect(f!.valorTotal).toBe(12345);
		expect(calls.get[0]).toMatchObject(["t_nfcom_faturas", expect.objectContaining({ filterByTk: 101 })]);
	});

	it("404 → null (fatura não encontrada)", async () => {
		const { client } = mockClient({
			get: async () => {
				throw new AtacadoError("Atacado 404", 404, "not found");
			},
		});
		const repo = new AtacadoRepository(client);
		expect(await repo.getFaturaPorId(999)).toBeNull();
	});

	it("propaga erro não-404 (ex.: 500)", async () => {
		const { client } = mockClient({
			get: async () => {
				throw new AtacadoError("Atacado 500", 500, "boom");
			},
		});
		const repo = new AtacadoRepository(client);
		await expect(repo.getFaturaPorId(1)).rejects.toBeInstanceOf(AtacadoError);
	});
});

describe("AtacadoRepository > buscarFaturaPorChave", () => {
	it("retorna Fatura quando encontra (com cobranças/notas/itens)", async () => {
		const { client } = mockClient({
			list: async () => [
				{
					id: 101,
					f_fk_parceiro: 42,
					f_data_referencia: "2026-08-01",
					f_data_vencimento: "2026-09-10",
					f_valor_total: 123.45,
					f_tipo_de_faturamento: "cofaturamento",
					f_status: "a-emitir",
					f_cobrancas: [],
				},
			],
		});
		const repo = new AtacadoRepository(client);
		const f = await repo.buscarFaturaPorChave(42, "2026-08-01");
		expect(f).not.toBeNull();
		expect(f!.id).toBe(101);
		expect(f!.valorTotal).toBe(12345);
	});

	it("retorna null quando não encontra", async () => {
		const { client } = mockClient({ list: async () => [] });
		const repo = new AtacadoRepository(client);
		const f = await repo.buscarFaturaPorChave(42, "2026-08-01");
		expect(f).toBeNull();
	});
});

describe("AtacadoRepository > buscarErrosPorFatura", () => {
	it("filtra t_nfcom_erros por $or de ids de cobrança/nota e mapeia p/ domínio", async () => {
		const { client, calls } = mockClient({
			list: async () => [
				{
					id: 1,
					f_fk_cobranca: 456,
					f_fk_nfcom: 0,
					f_erro: "BOLETO",
					f_mensagem: "customer inválido",
					f_status_code: "",
				},
				{
					id: 2,
					f_fk_cobranca: 0,
					f_fk_nfcom: 7,
					f_erro: "NFCOM",
					f_mensagem: "Duplicidade",
					f_status_code: "500",
				},
			],
		});
		const repo = new AtacadoRepository(client);
		const erros = await repo.buscarErrosPorFatura([456], [7]);
		expect(erros).toEqual([
			{ id: 1, cobrancaId: 456, notaId: undefined, erro: "BOLETO", mensagem: "customer inválido", statusCode: undefined },
			{ id: 2, cobrancaId: undefined, notaId: 7, erro: "NFCOM", mensagem: "Duplicidade", statusCode: "500" },
		]);
		expect(calls.list[0][0]).toBe("t_nfcom_erros");
		expect(calls.list[0][1]).toEqual({
			filter: { "$or": [{ f_fk_cobranca: 456 }, { f_fk_nfcom: 7 }] },
		});
	});

	it("sem ids → [] sem chamar o client", async () => {
		const { client, calls } = mockClient();
		const repo = new AtacadoRepository(client);
		expect(await repo.buscarErrosPorFatura([], [])).toEqual([]);
		expect(calls.list).toBeUndefined();
	});

	it("404 → [] (padrão de list do NocoBase)", async () => {
		const { client } = mockClient({
			list: async () => {
				throw new AtacadoError("Atacado 404", 404, "not found");
			},
		});
		const repo = new AtacadoRepository(client);
		expect(await repo.buscarErrosPorFatura([456], [])).toEqual([]);
	});
});
