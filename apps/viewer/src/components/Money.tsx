import { formatBRLCents, formatBRLReais } from "../format";

/** Valor em centavos inteiros, formatado em BRL. */
export function Money({ cents }: { cents: number | null | undefined }) {
	return <span className="tabular-nums">{formatBRLCents(cents)}</span>;
}

/** Valor já em reais (number), formatado em BRL. */
export function MoneyReais({ value }: { value: number }) {
	return <span className="tabular-nums">{formatBRLReais(value)}</span>;
}
