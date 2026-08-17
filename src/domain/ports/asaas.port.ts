/**
 * Porta do módulo Asaas (cobrança — ADR-0004).
 *
 * Boleto via Asaas API v3. A dedup do boleto usa `externalReference =
 * cobranca:{id}` e **consulta pela referência antes de re-emitir** no crash
 * pós-POST (ADR-0003 item 4 / SPEC-0001 caso 5) — o Asaas oferece ambos
 * (referência própria + consulta por referência), ao contrário do NFCom.
 *
 * Monetário em centavos na fronteira; o módulo traduz p/ a unidade do Asaas.
 */
export interface AsaasCustomer {
	id: string;
	name: string;
	email: string;
	cpfCnpj: string;
}

export interface CriarCustomerInput {
	name: string;
	email: string;
	cpfCnpj: string;
}

export interface AtualizarCustomerInput {
	name?: string;
	email?: string;
}

export interface CriarBoletoInput {
	customerId: string;
	/** Valor em centavos. */
	valor: number;
	/** Vencimento `YYYY-MM-DD`. */
	vencimento: string;
	/** `cobranca:{id}` — referência própria determinística (ADR-0003). */
	externalReference: string;
}

export interface BoletoResultado {
	idExterno: string;
	linkFatura: string;
}

export interface AsaasPort {
	buscarCustomerPorDocumento(cpfcnpj: string): Promise<AsaasCustomer | null>;
	criarCustomer(input: CriarCustomerInput): Promise<AsaasCustomer>;
	atualizarCustomer(
		id: string,
		input: AtualizarCustomerInput,
	): Promise<AsaasCustomer>;
	criarBoleto(input: CriarBoletoInput): Promise<BoletoResultado>;
	/**
	 * Consulta por `externalReference` antes de re-emitir no retry pós-crash
	 * (SPEC-0001 caso 5). Retorna `null` se não encontrar → re-emite.
	 */
	consultarBoletoPorExternalReference(
		externalReference: string,
	): Promise<BoletoResultado | null>;
}
