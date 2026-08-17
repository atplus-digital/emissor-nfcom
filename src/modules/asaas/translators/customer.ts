/**
 * Translator de customer Asaas ↔ domínio (ADR-0004).
 *
 * Customer não tem conversão monetária — só mapeamento de campos. O documento
 * é limpo (sem máscara) em ambos os lados.
 */
import type { AsaasCustomer, CriarCustomerInput } from "#/domain/ports/asaas.port";
import type { AsaasCustomerDTO } from "../asaas.client";

export function toDomainCustomer(dto: AsaasCustomerDTO): AsaasCustomer {
	return { id: dto.id, name: dto.name, email: dto.email, cpfCnpj: dto.cpfCnpj };
}

export function toAsaasCustomer(input: CriarCustomerInput): {
	name: string;
	email: string;
	cpfCnpj: string;
} {
	return { name: input.name, email: input.email, cpfCnpj: input.cpfCnpj };
}
