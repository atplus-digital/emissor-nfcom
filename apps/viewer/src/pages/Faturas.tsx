import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ApiError, listFaturas, listParceiros } from "../api";
import { MoneyReais } from "../components/Money";
import { StatusBadge } from "../components/StatusBadge";
import { formatData } from "../format";
import type { FaturaResumo } from "../types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

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
	// Cache id→nome do parceiro (carregado uma vez, não refetch por filtro).
	const [nomesParceiros, setNomesParceiros] = useState<
		Map<number, string>
	>(new Map());

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
		// Nomes dos parceiros em paralelo com a busca inicial.
		listParceiros()
			.then((lista) => {
				const m = new Map<number, string>();
				for (const p of lista) m.set(p.id, p.razaoSocial);
				setNomesParceiros(m);
			})
			.catch(() => {
				// Sem nomes a lista segue mostrando só o id.
			});
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
		<div className="space-y-4">
			<h1 className="text-xl font-semibold">Faturas</h1>

			<form
				className="flex flex-wrap items-end gap-4 rounded-lg border bg-card p-4"
				onSubmit={onSubmit}
			>
				<div className="flex min-w-[160px] max-w-[260px] flex-1 flex-col gap-1.5">
					<Label>Parceiro (id)</Label>
					<Input
						type="number"
						min={1}
						placeholder="ex.: 123"
						value={filtro.parceiroId}
						onChange={(e) =>
							setFiltro((f) => ({ ...f, parceiroId: e.target.value }))
						}
					/>
				</div>
				<div className="flex min-w-[160px] max-w-[260px] flex-1 flex-col gap-1.5">
					<Label>Referência</Label>
					<Input
						type="date"
						value={filtro.dataReferencia}
						onChange={(e) =>
							setFiltro((f) => ({ ...f, dataReferencia: e.target.value }))
						}
					/>
				</div>
				<div className="flex min-w-[160px] max-w-[260px] flex-1 flex-col gap-1.5">
					<Label>Status</Label>
					<Select
						value={filtro.status}
						onValueChange={(v) => setFiltro((f) => ({ ...f, status: v }))}
					>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{STATUS_OPCOES.map((o) => (
								<SelectItem key={o.value} value={o.value}>
									{o.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="ml-auto flex gap-2">
					<Button type="submit" disabled={carregando}>
						{carregando ? "Buscando…" : "Buscar"}
					</Button>
					<Button type="button" variant="ghost" onClick={onLimpar}>
						Limpar
					</Button>
				</div>
			</form>

			{erro && (
				<Alert variant="destructive" role="alert">
					<AlertDescription>{erro}</AlertDescription>
				</Alert>
			)}

			{!carregando && buscou && !erro && faturas.length === 0 && (
				<p className="text-muted-foreground">Nenhuma fatura encontrada.</p>
			)}

			{carregando && <p className="text-muted-foreground">Carregando…</p>}

			{!carregando && !erro && faturas.length > 0 && (
				<div className="overflow-x-auto rounded-lg border bg-card">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Fatura</TableHead>
								<TableHead>Parceiro</TableHead>
								<TableHead>Referência</TableHead>
								<TableHead>Vencimento</TableHead>
								<TableHead>Tipo</TableHead>
								<TableHead>Valor</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Cobranças</TableHead>
								<TableHead aria-label="Ações" />
							</TableRow>
						</TableHeader>
						<TableBody>
							{visiveis.map((f) => (
								<TableRow key={f.id}>
									<TableCell>{f.id}</TableCell>
									<TableCell>
										{nomesParceiros.get(f.parceiroId)
											? `${nomesParceiros.get(f.parceiroId)} (${f.parceiroId})`
											: f.parceiroId}
									</TableCell>
									<TableCell>{formatData(f.dataReferencia)}</TableCell>
									<TableCell>{formatData(f.dataVencimento)}</TableCell>
									<TableCell>{f.tipoFaturamento}</TableCell>
									<TableCell className="text-right tabular-nums">
										<MoneyReais value={f.valorTotal} />
									</TableCell>
									<TableCell>
										<StatusBadge escopo="fatura" value={f.status} />
									</TableCell>
									<TableCell className="text-right">
										{f.cobrancasCount}
									</TableCell>
									<TableCell>
										<Button asChild variant="ghost" size="sm">
											<Link to={`/faturas/${f.id}`}>Ver</Link>
										</Button>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			)}

			{totalPaginas > 1 && (
				<div className="mt-3 flex items-center justify-center gap-3">
					<Button
						variant="ghost"
						size="sm"
						disabled={pagina <= 1 || carregando}
						onClick={() => void buscar(filtro, pagina - 1)}
					>
						← Anterior
					</Button>
					<span className="text-muted-foreground">
						Página {pagina} de {totalPaginas} ({faturas.length} faturas)
					</span>
					<Button
						variant="ghost"
						size="sm"
						disabled={pagina >= totalPaginas || carregando}
						onClick={() => void buscar(filtro, pagina + 1)}
					>
						Próxima →
					</Button>
				</div>
			)}
		</div>
	);
}
