/**
 * Translator de boleto Asaas ↔ domínio (ADR-0004).
 *
 * Conversão monetária na fronteira: domínio = centavos inteiros; Asaas = unidade
 * real (decimal). Arredondamento determinístico via `Math.round`.
 * `externalReference = cobranca:{id}` é string — não se traduz (ADR-0003).
 */
import type {
	BoletoResultado,
	CriarBoletoInput,
} from "#/domain/ports/asaas.port";
import type { CriarPaymentBody, AsaasPaymentDTO } from "../asaas.client";

/** Centavos → unidade real (div 100). */
export function centsToReal(cents: number): number {
	return cents / 100;
}

/** Unidade real → centavos (round determinístico). */
export function realToCents(real: number): number {
	return Math.round(real * 100);
}

export function toBoletoBody(input: CriarBoletoInput): CriarPaymentBody {
	return {
		customer: input.customerId,
		billingType: "BOLETO",
		value: centsToReal(input.valor),
		dueDate: input.vencimento,
		externalReference: input.externalReference,
	};
}

export function toBoletoResultado(dto: AsaasPaymentDTO): BoletoResultado {
	return { idExterno: dto.id, linkFatura: dto.invoiceUrl };
}
