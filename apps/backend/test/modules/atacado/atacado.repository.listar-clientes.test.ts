/**
 * AtacadoRepository.listarClientesParceiro (painel — clientes do parceiro
 * com filtro + paginação de verdade).
 *
 * Contrato:
 * - `client.listPage(t_clientes, { filter, appends, page, pageSize })` —
 *   paginação real (sem o 9999 do `list`).
 * - Filter sempre com `f_fk_parceiro` + SÓ os filtros presentes:
 *   - `busca` → `$or` com `$like %busca%` em f_nome_razao e f_fantasia.
 *   - `cpfcnpj` → igualdade no formato mascarado (o CRM armazena mascarado;
 *     mascararDoc é idempotente: dígitos ou mascarado → mascarado).
 *   - `cidade` → igualdade em f_cidade.
 *   - `uf` → igualdade em f_uf, normalizado p/ maiúsculas.
 * - Mapeia p/ `ListaPaginada<Cliente>` (itens via clienteToDomain; `total`
 *   do `meta.count` do NocoBase, repassado pelo client).
 * - 404 do Atacado (list sem registros) → `{ itens: [], total: 0 }`.
 */
import { describe, expect, it, mock } from "bun:test";
import { AtacadoError, type AtacadoClient } from "#/modules/atacado/atacado.client";
import { AtacadoRepository } from "#/modules/atacado/atacado.repository";

/** Mock do AtacadoClient com spies registrando as chamadas (mesmo padrão de
 * atacado.repository.listar.test.ts), incluindo `listPage`. */
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
		listPage: make("listPage"),
		create: make("create"),
		destroy: make("destroy"),
		update: make("update"),
	} as unknown as AtacadoClient;
	return { client, calls };
}

/** Linha externa de cliente (t_clientes) com uma linha fixa + plano appendados. */
const LINHA_CLIENTE = {
	id: 7,
	f_nome_razao: "ORGARINO DE BONA SARTOR",
	f_fantasia: null,
	f_cpf_cnpj: "029.646.949-15",
	f_email: "c@x.com",
	f_endereco: "Rua A",
	f_numero: "1",
	f_bairro: "B",
	f_cep: "89188000",
	f_cidade: "Rio Rufino",
	f_uf: "SC",
	f_linhas_fixas: [
		{
			id: 90,
			f_qtde_servicos: 2,
			f_planos_de_servico: { id: 100, f_nome: "Plano 100Mbps", f_assinatura_mensal: 99.9 },
		},
	],
};

const PAGINA = { page: 2, pageSize: 5 };

describe("AtacadoRepository > listarClientesParceiro", () => {
	it("sempre filtra por f_fk_parceiro + appends linhas (mesmo sem filtro extra)", async () => {
		const { client, calls } = mockClient({
			listPage: async () => ({ items: [LINHA_CLIENTE], total: 12 }),
		});
		const repo = new AtacadoRepository(client);
		await repo.listarClientesParceiro(42, {}, PAGINA);
		expect(calls.listPage[0][0]).toBe("t_clientes");
		const query = calls.listPage[0][1] as Record<string, unknown>;
		expect(query.filter).toEqual({ f_fk_parceiro: 42 });
		expect(query.appends).toEqual([
			"f_linhas_fixas",
			"f_linhas_fixas.f_planos_de_servico",
		]);
		expect(query.page).toBe(2);
		expect(query.pageSize).toBe(5);
	});

	it("busca → $or com $like em f_nome_razao e f_fantasia", async () => {
		const { client, calls } = mockClient({
			listPage: async () => ({ items: [], total: 0 }),
		});
		const repo = new AtacadoRepository(client);
		await repo.listarClientesParceiro(42, { busca: "sartor" }, PAGINA);
		const query = calls.listPage[0][1] as { filter: Record<string, unknown> };
		expect(query.filter).toEqual({
			f_fk_parceiro: 42,
			$or: [
				{ f_nome_razao: { $like: "%sartor%" } },
				{ f_fantasia: { $like: "%sartor%" } },
			],
		});
	});

	it("cpfcnpj em dígitos → igualdade no formato mascarado (como o CRM armazena)", async () => {
		const { client, calls } = mockClient({
			listPage: async () => ({ items: [], total: 0 }),
		});
		const repo = new AtacadoRepository(client);
		await repo.listarClientesParceiro(42, { cpfcnpj: "02964694915" }, PAGINA);
		const query = calls.listPage[0][1] as { filter: Record<string, unknown> };
		expect(query.filter).toEqual({
			f_fk_parceiro: 42,
			f_cpf_cnpj: "029.646.949-15",
		});
	});

	it("cpfcnpj já mascarado → idempotente (mesmo valor)", async () => {
		const { client, calls } = mockClient({
			listPage: async () => ({ items: [], total: 0 }),
		});
		const repo = new AtacadoRepository(client);
		await repo.listarClientesParceiro(42, { cpfcnpj: "029.646.949-15" }, PAGINA);
		const query = calls.listPage[0][1] as { filter: Record<string, unknown> };
		expect(query.filter.f_cpf_cnpj).toBe("029.646.949-15");
	});

	it("cidade → igualdade em f_cidade; uf → maiúsculas em f_uf", async () => {
		const { client, calls } = mockClient({
			listPage: async () => ({ items: [], total: 0 }),
		});
		const repo = new AtacadoRepository(client);
		await repo.listarClientesParceiro(42, { cidade: "Rio Rufino", uf: "sc" }, PAGINA);
		const query = calls.listPage[0][1] as { filter: Record<string, unknown> };
		expect(query.filter).toEqual({
			f_fk_parceiro: 42,
			f_cidade: "Rio Rufino",
			f_uf: "SC",
		});
	});

	it("filtro completo → todos os campos no filter", async () => {
		const { client, calls } = mockClient({
			listPage: async () => ({ items: [], total: 0 }),
		});
		const repo = new AtacadoRepository(client);
		await repo.listarClientesParceiro(
			42,
			{ busca: "a", cpfcnpj: "11122233344", cidade: "X", uf: "pr" },
			{ page: 1, pageSize: 10 },
		);
		const query = calls.listPage[0][1] as { filter: Record<string, unknown> };
		expect(query.filter).toEqual({
			f_fk_parceiro: 42,
			$or: [
				{ f_nome_razao: { $like: "%a%" } },
				{ f_fantasia: { $like: "%a%" } },
			],
			f_cpf_cnpj: "111.222.333-44",
			f_cidade: "X",
			f_uf: "PR",
		});
		expect(query.page).toBe(1);
		expect(query.pageSize).toBe(10);
	});

	it("mapeia itens p/ Cliente (centavos, doc limpo) e repassa o total", async () => {
		const { client } = mockClient({
			listPage: async () => ({ items: [LINHA_CLIENTE], total: 12 }),
		});
		const repo = new AtacadoRepository(client);
		const r = await repo.listarClientesParceiro(42, {}, { page: 1, pageSize: 5 });
		expect(r.total).toBe(12);
		expect(r.itens).toHaveLength(1);
		const c = r.itens[0];
		expect(c.id).toBe(7);
		expect(c.nome).toBe("ORGARINO DE BONA SARTOR");
		expect(c.cpfcnpj).toBe("02964694915"); // desmascarado no domínio
		expect(c.endereco.cidade).toBe("Rio Rufino");
		expect(c.endereco.uf).toBe("SC");
		expect(c.linhas).toEqual([
			{ planoId: 100, descricao: "Plano 100Mbps", unitario: 9990, quantidade: 2 },
		]);
	});

	it("404 do client → { itens: [], total: 0 } (NocoBase: list sem registros)", async () => {
		const { client } = mockClient({
			listPage: async () => {
				throw new AtacadoError("Atacado 404", 404, "Not Found");
			},
		});
		const repo = new AtacadoRepository(client);
		expect(await repo.listarClientesParceiro(999, {}, PAGINA)).toEqual({
			itens: [],
			total: 0,
		});
	});

	it("propaga erro não-404 (ex.: 500)", async () => {
		const { client } = mockClient({
			listPage: async () => {
				throw new AtacadoError("Atacado 500", 500, "boom");
			},
		});
		const repo = new AtacadoRepository(client);
		await expect(repo.listarClientesParceiro(42, {}, PAGINA)).rejects.toBeInstanceOf(
			AtacadoError,
		);
	});
});
