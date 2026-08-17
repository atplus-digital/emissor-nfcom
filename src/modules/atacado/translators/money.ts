/**
 * Translators de dinheiro e documento (fronteira Atacado ↔ domínio — ADR-0004).
 *
 * O CRM NocoBase entrega monetário como number/string em unidade real
 * (123.45, ou "1.234,56" pt-BR); o domínio opera em centavos inteiros.
 * Documentos chegam mascarados ("12.345.678/0001-99"); o domínio usa limpos.
 */
export function realToCents(real: number | string): number {
	if (typeof real === "string") {
		// formato pt-BR: "1.234,56" → 1234.56 ; ou "123.45" → 123.45
		const hasComma = real.includes(",");
		let normalized: string;
		if (hasComma) {
			normalized = real.replace(/\./g, "").replace(",", ".");
		} else {
			normalized = real;
		}
		return Math.round(Number.parseFloat(normalized) * 100);
	}
	return Math.round(real * 100);
}

export function centsToReal(cents: number): number {
	return cents / 100;
}

export function desmascararDoc(doc: string): string {
	return doc.replace(/[.\-/\s]/g, "");
}
