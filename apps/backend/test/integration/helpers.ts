/**
 * Helpers do teste de integração do Flow (C4). Fakes in-memory das portas
 * externas (Atacado/Asaas/NFCom) + verificação de disponibilidade do Redis.
 *
 * A integração que importa é BullMQ(Flows) + Redis real + SQLite de coordenação
 * (lease/idempotency/outbox) — os provedores externos são FAKES porque a lógica
 * de domínio deles já é coberta por unit tests.
 */
import { Redis } from "ioredis";
import type { AtacadoPort } from "#/domain/ports/atacado.port";
import type { AsaasPort } from "#/domain/ports/asaas.port";
import type { NfcomPort } from "#/domain/ports/nfcom.port";
import type { Fatura } from "#/domain/types";

/** Chave SEFAZ fictícia (44 dígitos) — suficiente p/ os fakes. */
export const CHAVE_SEFAZ = "35260800000000000000000000000000000000000000";

/** Endereço mínimo válido do domínio (SPEC-0002 caso 13). */
const endereco = {
	logradouro: "Rua A",
	numero: "100",
	bairro: "Centro",
	cep: "80000000",
	cidade: "Curitiba",
	uf: "PR",
};

/**
 * Monta uma fatura com a árvore completa: 1 cobrança `a-emitir` com 1 nota
 * `a-emitir` (1 item). É o cenário feliz para o Flow validar o fan-out
 * parent → children → grandchildren e a consolidação final `emitida`.
 */
export function montarFaturaArvore(
	faturaId = 900,
	cobrancaId = 901,
	notaId = 910,
): Fatura {
	return {
		id: faturaId,
		parceiroId: 1,
		dataReferencia: "2026-08-01",
		dataVencimento: "2026-09-10",
		valorTotal: 10000,
		tipoFaturamento: "parceiro",
		status: "a-emitir",
		cobrancas: [
			{
				id: cobrancaId,
				faturaId,
				valorTotal: 10000,
				nomeDevedor: "Maria Silva",
				documentoDevedor: "12345678901",
				emailDevedor: "maria@example.com",
				status: "a-emitir",
				dataVencimento: "2026-09-10",
				notas: [
					{
						id: notaId,
						cobrancaId,
						nome: "Maria Silva",
						cpfcnpj: "12345678901",
						email: "maria@example.com",
						endereco,
						uf: "PR",
						cidade: "Curitiba",
						statusInterno: "a-emitir",
						total: 10000,
						itens: [
							{
								descricao: "Plano de internet 500MB",
								cfop: "6102",
								cclass: "0000",
								quantidade: 1,
								unitario: 10000,
								total: 10000,
								aliqIcms: 0,
								bcIcms: 0,
								icms: 0,
								incideAliquota: false,
							},
						],
					},
				],
			},
		],
	};
}

/** Atacado fake: `getFaturaPorId` devolve a árvore; writes ficam no outbox. */
export function criarFakeAtacado(fatura: Fatura): AtacadoPort {
	return {
		getFaturaPorId: async (id: number) => (id === fatura.id ? fatura : null),
	} as AtacadoPort;
}

/** Asaas fake: customer novo + boleto ok (happy path, caso 5/16). */
export function criarFakeAsaas(): AsaasPort {
	return {
		buscarCustomerPorDocumento: async () => null,
		criarCustomer: async ({ name, email, cpfCnpj }) => ({
			id: "cus_1",
			name,
			email,
			cpfCnpj,
		}),
		atualizarCustomer: async (id, input) => ({ id, name: input.name ?? "", email: input.email ?? "", cpfCnpj: "" }),
		criarBoleto: async () => ({ idExterno: "bol_1", linkFatura: "https://asaas/boleto" }),
		consultarBoletoPorExternalReference: async () => null,
	} as AsaasPort;
}

/** NFCom fake: emitir retorna `autorizada` com chave/protocolo (caso 6/7). */
export function criarFakeNfcom(): NfcomPort {
	return {
		autenticar: async () => "token",
		emitirNFCom: async () => ({
			situacao: "autorizada",
			numero: 123,
			serie: 1,
			chave: CHAVE_SEFAZ,
			protocolo: "PROTO-1",
			ambiente: 2,
		}),
		consultarLista: async () => [],
	} as NfcomPort;
}

/**
 * Verifica se há um Redis alcançável em `REDIS_URL` (default localhost:6379).
 * Falha rápido (connectTimeout curto + retryStrategy nulo) para o setup não
 * travar quando não há Redis.
 */
export async function redisDisponivel(url = "redis://localhost:6379"): Promise<boolean> {
	const redis = new Redis(url, {
		lazyConnect: true,
		connectTimeout: 2000,
		maxRetriesPerRequest: 1,
		retryStrategy: () => null,
	});
	try {
		await redis.connect();
		const pong = await redis.ping();
		return pong === "PONG";
	} catch {
		return false;
	} finally {
		redis.disconnect();
	}
}
