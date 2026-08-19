/**
 * Repository Asaas — implementa `AsaasPort` (ADR-0004).
 *
 * Camada entre o domínio (centavos, tipos próprios) e o cliente externo Asaas
 * (unidade real, shapes `errors[]`). Nenhum tipo externo do Asaas cruza esta
 * fronteira: o repository só devolve tipos de domínio.
 *
 * Dedup do boleto: `externalReference = cobranca:{id}` + consulta pela
 * referência antes de re-emitir no crash pós-POST (SPEC-0001 caso 5) — o
 * `consultarBoletoPorExternalReference` retorna `null` quando não encontra,
 * sinalizando ao caller que pode re-emitir.
 */
import type {
	AsaasPort,
	AsaasCustomer,
	BoletoResultado,
	CriarBoletoInput,
	CriarCustomerInput,
	AtualizarCustomerInput,
} from "#/domain/ports/asaas.port";
import type { AsaasClient } from "./asaas.client";
import { toAsaasCustomer, toDomainCustomer } from "./translators/customer";
import { toBoletoBody, toBoletoResultado } from "./translators/boleto";

export class AsaasRepository implements AsaasPort {
	constructor(private readonly client: AsaasClient) {}

	async buscarCustomerPorDocumento(cpfcnpj: string): Promise<AsaasCustomer | null> {
		const r = await this.client.buscarCustomerPorDocumento(cpfcnpj);
		if (r.totalCount === 0 || r.data.length === 0) return null;
		const first = r.data[0];
		if (!first) return null;
		return toDomainCustomer(first);
	}

	async criarCustomer(input: CriarCustomerInput): Promise<AsaasCustomer> {
		const dto = await this.client.criarCustomer(toAsaasCustomer(input));
		return toDomainCustomer(dto);
	}

	async atualizarCustomer(id: string, input: AtualizarCustomerInput): Promise<AsaasCustomer> {
		const dto = await this.client.atualizarCustomer(id, input);
		return toDomainCustomer(dto);
	}

	async criarBoleto(input: CriarBoletoInput): Promise<BoletoResultado> {
		const dto = await this.client.criarPayment(toBoletoBody(input));
		return toBoletoResultado(dto);
	}

	async consultarBoletoPorExternalReference(
		externalReference: string,
	): Promise<BoletoResultado | null> {
		const r = await this.client.consultarPaymentPorExternalReference(externalReference);
		if (r.totalCount === 0 || r.data.length === 0) return null;
		const first = r.data[0];
		if (!first) return null;
		return toBoletoResultado(first);
	}
}
