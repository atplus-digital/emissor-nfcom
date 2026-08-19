import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ApiError, listFaturas } from "../api";
import { MoneyReais } from "../components/Money";
import { StatusBadge } from "../components/StatusBadge";
import { formatData } from "../format";
import type { FaturaResumo } from "../types";

const STATUS_OPCOES: { value: string; label: string }[] = [
	{ value: "", label: "Todos" },
	{ value: "a-emitir", label: "A emitir" },
	{ value: "emitindo", label: "Emitindo" },
	{ value: "emitida", label: "Emitida" },
	{ value: "parcial", label: "Parcial" },
	{ value: "erro", label: "Erro" },
	{ value: "pago", label: "Pago" },
	{ value: "cancelada", label: "Cancelada" },
];

interface Filtro {
	parceiroId: string;
	dataReferencia: string;
	status: string;
}

const FILTRO_VAZIO: Filtro = { parceiroId: "", dataReferencia: "", status: "" };
const POR_PAGINA = 20;

export function Faturas() {
	const [filtro, setFiltro] = useState<Filtro>(FILTRO_VAZIO);
	const [faturas, setFaturas] = useState<FaturaResumo[]>([]);
	const [pagina, setPagina] = useState(1);
	const [carregando, setCarregando] = useState(false);
	const [erro, setErro] = useState<string | null>(null);
	const [buscou, setBuscou] = useState(false);

	const buscar = useCallback(
		async (f: Filtro, p = 1) => {
			setCarregando(true);
			setErro(null);
			setBuscou(true);
			setPagina(p);
			try {
				const resumo = await listFaturas({
					parceiroId: f.parceiroId || undefined,
					dataReferencia: f.dataReferencia || undefined,
					status: f.status || undefined,
				});
				// Ordenação decrescente por referência (mais recentes primeiro).
				resumo.sort((a, b) => (a.dataReferencia < b.dataReferencia ? 1 : -1));
				setFaturas(resumo);
			} catch (err) {
				setErro(
					err instanceof ApiError
						? err.mensagem
						: "Erro inesperado ao carregar faturas.",
				);
				setFaturas([]);
			} finally {
				setCarregando(false);
			}
		},
		[],
	);

	// Busca inicial sem filtros.
	useEffect(() => {
		void buscar(FILTRO_VAZIO);
	}, [buscar]);

	const onSubmit = (e: FormEvent) => {
		e.preventDefault();
		void buscar(filtro, 1);
	};

	const onLimpar = () => {
		setFiltro(FILTRO_VAZIO);
		void buscar(FILTRO_VAZIO, 1);
	};

	const totalPaginas = Math.max(1, Math.ceil(faturas.length / POR_PAGINA));
	const inicio = (pagina - 1) * POR_PAGINA;
	const visiveis = faturas.slice(inicio, inicio + POR_PAGINA);

	return (
		<div>
			<h1>Faturas</h1>

			<form className="filters" onSubmit={onSubmit}>
				<label>
					<span>Parceiro (id)</span>
					<input
						type="number"
						min={1}
						placeholder="ex.: 123"
						value={filtro.parceiroId}
						onChange={(e) =>
							setFiltro((f) => ({ ...f, parceiroId: e.target.value }))
						}
					/>
				</label>
				<label>
					<span>Referência</span>
					<input
						type="date"
						value={filtro.dataReferencia}
						onChange={(e) =>
							setFiltro((f) => ({ ...f, dataReferencia: e.target.value }))
						}
					/>
				</label>
				<label>
					<span>Status</span>
					<select
						value={filtro.status}
						onChange={(e) =>
							setFiltro((f) => ({ ...f, status: e.target.value }))
						}
					>
						{STATUS_OPCOES.map((o) => (
							<option key={o.value} value={o.value}>
								{o.label}
							</option>
						))}
					</select>
				</label>
				<div className="filters-actions">
					<button type="submit" className="btn btn-primary" disabled={carregando}>
						{carregando ? "Buscando…" : "Buscar"}
					</button>
					<button type="button" className="btn btn-ghost" onClick={onLimpar}>
						Limpar
					</button>
				</div>
			</form>

			{erro && (
				<div className="alert alert-error" role="alert">
					{erro}
				</div>
			)}

			{!carregando && buscou && !erro && faturas.length === 0 && (
				<p className="muted">Nenhuma fatura encontrada.</p>
			)}

			{carregando && <p className="muted">Carregando…</p>}

			{!carregando && !erro && faturas.length > 0 && (
				<div className="table-wrap">
					<table>
						<thead>
							<tr>
								<th>Fatura</th>
								<th>Parceiro</th>
								<th>Referência</th>
								<th>Vencimento</th>
								<th>Tipo</th>
								<th>Valor</th>
								<th>Status</th>
								<th>Cobranças</th>
								<th aria-label="Ações" />
							</tr>
						</thead>
						<tbody>
							{visiveis.map((f) => (
								<tr key={f.id}>
									<td>{f.id}</td>
									<td>{f.parceiroId}</td>
									<td>{formatData(f.dataReferencia)}</td>
									<td>{formatData(f.dataVencimento)}</td>
									<td>{f.tipoFaturamento}</td>
									<td className="num">
										<MoneyReais value={f.valorTotal} />
									</td>
									<td>
										<StatusBadge escopo="fatura" value={f.status} />
									</td>
									<td className="num">{f.cobrancasCount}</td>
									<td>
										<Link className="btn btn-small" to={`/faturas/${f.id}`}>
											Ver
										</Link>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			{totalPaginas > 1 && (
				<div className="pagination">
					<button
						className="btn btn-small"
						disabled={pagina <= 1 || carregando}
						onClick={() => void buscar(filtro, pagina - 1)}
					>
						← Anterior
					</button>
					<span className="muted">
						Página {pagina} de {totalPaginas} ({faturas.length} faturas)
					</span>
					<button
						className="btn btn-small"
						disabled={pagina >= totalPaginas || carregando}
						onClick={() => void buscar(filtro, pagina + 1)}
					>
						Próxima →
					</button>
				</div>
			)}
		</div>
	);
}
