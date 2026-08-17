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
