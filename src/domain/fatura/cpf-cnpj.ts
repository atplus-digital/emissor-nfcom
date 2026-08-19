/**
 * Validação de CPF/CNPJ por dígito verificador (SPEC-0002 caso 4, pipeline de
 * documentos ADR-0004). Desmascara antes de validar (remove ./- e /).
 */

/** Remove caracteres de máscara de documento. */
function desmascarar(doc: string): string {
	return doc.replace(/[.\-/]/g, "");
}

function todosIguais(s: string): boolean {
	return s.length > 0 && s.split("").every((c) => c === s[0]);
}

function validarDigito(digitos: string, pesos: number[]): boolean {
	const soma = digitos
		.split("")
		.slice(0, pesos.length)
		.reduce((acc, d, i) => acc + Number(d) * (pesos[i] ?? 0), 0);
	const resto = soma % 11;
	const dv = resto < 2 ? 0 : 11 - resto;
	const dvEsperado = Number(digitos[pesos.length] ?? NaN);
	return dv === dvEsperado;
}

/**
 * Valida CPF (11 dígitos) pelo dígito verificador. Aceita mascarado ou limpo.
 * Rejeita tamanho errado, todos iguais e DV incorreto.
 */
export function validarCPF(cpf: string): boolean {
	const limpo = desmascarar(cpf);
	if (limpo.length !== 11 || !/^\d{11}$/.test(limpo)) return false;
	if (todosIguais(limpo)) return false;
	const p1 = [10, 9, 8, 7, 6, 5, 4, 3, 2];
	const p2 = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2];
	if (!validarDigito(limpo, p1)) return false;
	return validarDigito(limpo, p2);
}

/**
 * Valida CNPJ (14 dígitos) pelo dígito verificador. Aceita mascarado ou limpo.
 */
export function validarCNPJ(cnpj: string): boolean {
	const limpo = desmascarar(cnpj);
	if (limpo.length !== 14 || !/^\d{14}$/.test(limpo)) return false;
	if (todosIguais(limpo)) return false;
	const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
	const p2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
	if (!validarDigito(limpo, p1)) return false;
	return validarDigito(limpo, p2);
}

/** Remove caracteres de máscara de documento (alias público de `desmascarar`). */
export function desmascararDoc(doc: string): string {
	return desmascarar(doc);
}

/**
 * Aplica máscara pt-BR a um documento limpo: CPF 11 → `XXX.XXX.XXX-XX`,
 * CNPJ 14 → `XX.XXX.XXX/XXXX-XX`. Documento já mascarado ou de tamanho
 * desconhecido é retornado inalterado.
 *
 * Necessário para o gateway NFCom (Vigo), que roteia o elemento XML `CPF` vs
 * `CNPJ` pela **presença dos caracteres de formatação**, não pelo comprimento:
 * um CNPJ limpo de 14 dígitos é lido como CPF (TCpf aceita só 11) e rejeitado
 * com `Falha no schema XML`. Mascarado, é reconhecido como CNPJ. Espelha
 * `desmascararDoc` (domínio = limpo, gateway = mascarado).
 */
export function mascararDoc(doc: string): string {
	const limpo = desmascarar(doc);
	if (limpo.length === 11) {
		return `${limpo.slice(0, 3)}.${limpo.slice(3, 6)}.${limpo.slice(6, 9)}-${limpo.slice(9, 11)}`;
	}
	if (limpo.length === 14) {
		return `${limpo.slice(0, 2)}.${limpo.slice(2, 5)}.${limpo.slice(5, 8)}/${limpo.slice(8, 12)}-${limpo.slice(12, 14)}`;
	}
	return doc;
}
