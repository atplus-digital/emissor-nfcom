/** Helpers de formatação pt-BR. */

const brl = new Intl.NumberFormat("pt-BR", {
	style: "currency",
	currency: "BRL",
});

/** Formata um valor em reais (number) como moeda BRL. */
export function formatBRLReais(value: number): string {
	return brl.format(value);
}

/** Formata centavos inteiros como moeda BRL. */
export function formatBRLCents(cents: number | null | undefined): string {
	if (cents == null) return "—";
	return brl.format(cents / 100);
}

/** Formata uma data ISO (yyyy-mm-dd) como dd/mm/aaaa. */
export function formatData(iso: string | null | undefined): string {
	if (!iso) return "—";
	const [y, m, d] = iso.slice(0, 10).split("-");
	if (!y || !m || !d) return iso;
	return `${d}/${m}/${y}`;
}

/** Formata quantidade (pode ser decimal no CRM). */
export function formatQtd(qtd: number): string {
	return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 }).format(qtd);
}

/** Formata alíquota em % (ex.: 0.18 → 18%). */
export function formatAliq(v: number | null | undefined): string {
	if (v == null) return "—";
	return new Intl.NumberFormat("pt-BR", {
		style: "percent",
		maximumFractionDigits: 2,
	}).format(v);
}
