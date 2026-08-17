/**
 * Validação pré-persistência (SPEC-0002):
 * - caso 4: documento (CPF/CNPJ) do devedor e dos destinatários com dígito verificador
 *   válido (pipeline de documentos, ADR-0004).
 * - caso 13: endereço completo do destinatário (logradouro, número, bairro, CEP,
 *   cidade, UF) — exigido pelo MOC da NFCom.
 */
import type { Cliente, ErroValidacao, Nota, Parceiro } from "#/domain/types";
import { validarCNPJ, validarCPF } from "./cpf-cnpj";

/** Detecta se um documento é CPF (11) ou CNPJ (14) e valida o dígito. */
export function documentoValido(doc: string): boolean {
	const limpo = doc.replace(/[.\-/]/g, "");
	if (limpo.length === 11) return validarCPF(limpo);
	if (limpo.length === 14) return validarCNPJ(limpo);
	return false;
}

/**
 * Valida documentos (SPEC-0002 caso 4): devedor (parceiro) e destinatários das notas
 * + clientes. Retorna lista de erros (vazio = válido).
 */
export function validarDocumentos(
	devedor: Pick<Parceiro, "razaoSocial" | "cnpj">,
	notas: Nota[],
	clientes: Cliente[],
): ErroValidacao[] {
	const erros: ErroValidacao[] = [];
	if (!documentoValido(devedor.cnpj)) {
		erros.push({
			tipo: "FATAL",
			campo: "documentoDevedor",
			mensagem: `Documento do devedor inválido: ${devedor.razaoSocial}`,
		});
	}
	for (const n of notas) {
		if (!documentoValido(n.cpfcnpj)) {
			erros.push({
				tipo: "FATAL",
				campo: "cpfcnpj",
				mensagem: `Documento do destinatário inválido: ${n.nome}`,
			});
		}
	}
	for (const c of clientes) {
		if (!documentoValido(c.cpfcnpj)) {
			erros.push({
				tipo: "FATAL",
				campo: "cpfcnpj",
				mensagem: `Documento do cliente inválido: ${c.nome}`,
			});
		}
	}
	return erros;
}

/**
 * Valida endereço completo dos destinatários das notas (SPEC-0002 caso 13).
 * Retorna erro por nota com endereço incompleto.
 */
export function validarEnderecoDestinatario(notas: Nota[]): ErroValidacao[] {
	const campos: (keyof Nota["endereco"])[] = [
		"logradouro",
		"numero",
		"bairro",
		"cep",
		"cidade",
		"uf",
	];
	const erros: ErroValidacao[] = [];
	for (const n of notas) {
		const faltando = campos.filter((c) => !n.endereco[c] || n.endereco[c].trim() === "");
		if (faltando.length > 0) {
			erros.push({
				tipo: "FATAL",
				campo: "endereco",
				mensagem: `Destinatário ${n.nome} sem endereço completo para emissão da NFCom`,
			});
		}
	}
	return erros;
}
