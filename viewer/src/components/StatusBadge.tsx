/** Badge colorido por status de fatura/cobrança/nota e situação SEFAZ. */

const CORES: Record<string, string> = {
	"fatura|a-emitir": "badge-gray",
	"fatura|emitindo": "badge-yellow",
	"fatura|emitida": "badge-green",
	"fatura|parcial": "badge-yellow",
	"fatura|erro": "badge-red",
	"fatura|pago": "badge-blue",
	"fatura|cancelada": "badge-dark",
	"cobranca|a-emitir": "badge-gray",
	"cobranca|emitida": "badge-green",
	"cobranca|erro": "badge-red",
	"nota|a-emitir": "badge-gray",
	"nota|emitida": "badge-green",
	"nota|erro": "badge-red",
	"nota|cancelada": "badge-dark",
	"situacao|autorizada": "badge-green",
	"situacao|rejeitada": "badge-red",
	"situacao|cancelada": "badge-gray",
	"situacao|processando": "badge-yellow",
};

type Escopo = "fatura" | "cobranca" | "nota" | "situacao";

export function StatusBadge({
	escopo,
	value,
}: {
	escopo: Escopo;
	value: string | null | undefined;
}) {
	if (!value) return <span className="badge badge-gray">—</span>;
	const css = CORES[`${escopo}|${value}`] ?? "badge-gray";
	return <span className={`badge ${css}`}>{value}</span>;
}
