/**
 * Helpers de teste para as rotas HTTP: fakes de AtacadoPort/QueuePort e
 * fixtures de domínio (parceiro, clientes, planos, fatura) em centavos.
 *
 * Os fakes são objetos simples cujos métodos o teste pode sobrescrever; quando
 * o teste quer contar chamadas, cria um wrapper que empurra p/ um array.
 */
import type { AtacadoPort } from "#/domain/ports/atacado.port";
import type { QueuePort } from "#/domain/ports/queue.port";
import type {
	Cliente,
	Cobranca,
	Fatura,
	Parceiro,
	Plano,
} from "#/domain/types";

/** CNPJ válido (dígito verificador correto) — 11444777000161. */
export const CNPJ_VALIDO = "11444777000161";
/** CPF válido — 52998224725 (dígito verificador correto). */
export const CPF_VALIDO = "52998224725";

export function parceiroFixture(over: Partial<Parceiro> = {}): Parceiro {
	return {
		id: 42,
		razaoSocial: "Parceiro Ltda",
		fantasia: "Parceiro",
		cnpj: CNPJ_VALIDO,
		emailFaturamento: "fin@parceiro.com",
		diaVencimento: 10,
		endereco: {
			logradouro: "Rua Exemplo",
			numero: "123",
			bairro: "Centro",
			cep: "80000000",
			cidade: "Curitiba",
			uf: "PR",
		},
		ie: "123",
		...over,
	};
}

export function clienteFixture(over: Partial<Cliente> = {}): Cliente {
	return {
		id: 1,
		nome: "Cliente Final",
		cpfcnpj: CPF_VALIDO,
		email: "cli@x.com",
		endereco: {
			logradouro: "Rua Cliente",
			numero: "1",
			bairro: "B",
			cep: "80000000",
			cidade: "Curitiba",
			uf: "PR",
		},
		linhas: [{ planoId: 100, descricao: "Plano 100Mbps", unitario: 10000, quantidade: 1 }],
		...over,
	};
}

export function planoFixture(over: Partial<Plano> = {}): Plano {
	return { id: 100, descricao: "Plano 100Mbps", preco: 10000, ...over };
}

/** Fake de AtacadoPort. Métodos podem ser sobrescritos por teste. */
export function fakeAtacado(over: Partial<AtacadoPort> = {}): AtacadoPort {
	return {
		buscarParceiroPorId: async () => parceiroFixture(),
		buscarClientesAtivosPorParceiro: async () => [clienteFixture()],
		buscarPlanosDeServico: async () => [planoFixture()],
		buscarFaturaPorChave: async () => null,
		getFaturaPorId: async () => null,
		buscarErrosPorFatura: async () => [],
		criarFatura: async () => ({ id: 101 }),
		criarCobranca: async () => ({ id: 456 }),
		criarNota: async () => ({ id: 7 }),
		criarItem: async () => {},
		removerArvore: async () => {},
		atualizarStatusFatura: async () => {},
		atualizarStatusCobranca: async () => {},
		atualizarStatusNota: async () => {},
		registrarErro: async () => {},
		...over,
	};
}

/** Fake de QueuePort que registra chamadas de enfileirarEmissaoFatura. */
export function fakeQueue(
	over: Partial<QueuePort> = {},
): QueuePort & { calls: { faturaId: number }[] } {
	const calls: { faturaId: number }[] = [];
	return {
		enfileirarEmissaoFatura: async (faturaId: number) => {
			calls.push({ faturaId });
			return { jobId: "job-1" };
		},
		enfileirarWebhook: async () => {},
		...over,
		calls,
	} as any;
}

/** Constrói uma fatura a-emitir simples p/ testes de emissão. */
export function faturaAemitirFixture(over: Partial<Fatura> = {}): Fatura {
	const nota = {
		cobrancaId: 456,
		nome: "Cliente Final",
		cpfcnpj: CPF_VALIDO,
		endereco: clienteFixture().endereco,
		uf: "PR",
		cidade: "Curitiba",
		statusInterno: "a-emitir" as const,
		total: 10000,
		itens: [],
	};
	const cobranca: Cobranca = {
		id: 456,
		faturaId: 101,
		valorTotal: 10000,
		nomeDevedor: "Parceiro Ltda",
		documentoDevedor: CNPJ_VALIDO,
		emailDevedor: "fin@parceiro.com",
		status: "a-emitir",
		dataVencimento: "2026-09-10",
		notas: [nota as any],
	};
	return {
		id: 101,
		parceiroId: 42,
		dataReferencia: "2026-08-01",
		dataVencimento: "2026-09-10",
		valorTotal: 10000,
		tipoFaturamento: "parceiro",
		status: "a-emitir",
		cobrancas: [cobranca],
		...over,
	};
}
