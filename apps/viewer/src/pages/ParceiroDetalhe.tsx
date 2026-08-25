import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError, getParceiro, listClientes } from "../api";
import { MoneyReais } from "../components/Money";
import { formatQtd } from "../format";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type {
	ClientesPaginadas,
	ParceiroDetalhe as ParceiroDetalheType,
} from "../types";

const POR_PAGINA = 20;

interface Filtro {
	busca: string;
	cpfcnpj: string;
	cidade: string;
	uf: string;
}

const FILTRO_VAZIO: Filtro = { busca: "", cpfcnpj: "", cidade: "", uf: "" };

export function ParceiroDetalhe() {
	const { id } = useParams<{ id: string }>();
	const [parceiro, setParceiro] = useState<ParceiroDetalheType | null>(null);
	const [erro, setErro] = useState<string | null>(null);
	const [carregando, setCarregando] = useState(true);

	const [filtro, setFiltro] = useState<Filtro>(FILTRO_VAZIO);
	const [clientes, setClientes] = useState<ClientesPaginadas | null>(null);
	const [erroClientes, setErroClientes] = useState<string | null>(null);
	const [carregandoClientes, setCarregandoClientes] = useState(false);

	const carregarClientes = useCallback(
		async (parceiroId: number, f: Filtro, pagina: number) => {
			setCarregandoClientes(true);
			setErroClientes(null);
			try {
				const cl = await listClientes(parceiroId, {
					pagina,
					pageSize: POR_PAGINA,
					busca: f.busca || undefined,
					cpfcnpj: f.cpfcnpj || undefined,
					cidade: f.cidade || undefined,
					uf: f.uf || undefined,
				});
				setClientes(cl);
			} catch (err) {
				setClientes(null);
				setErroClientes(
					err instanceof ApiError
						? err.mensagem
						: "Não foi possível carregar os clientes.",
				);
			} finally {
				setCarregandoClientes(false);
			}
		},
		[],
	);

	const carregar = useCallback(async () => {
		if (!id) return;
		setCarregando(true);
		setErro(null);
		try {
			const p = await getParceiro(id);
			setParceiro(p);
			// Clientes é complementar — falha nele não derruba o detalhe.
			void carregarClientes(p.id, FILTRO_VAZIO, 1);
		} catch (err) {
			setParceiro(null);
			setClientes(null);
			setErro(
				err instanceof ApiError
					? err.mensagem
					: "Erro inesperado ao carregar o parceiro.",
			);
		} finally {
			setCarregando(false);
		}
	}, [id, carregarClientes]);

	useEffect(() => {
		void carregar();
	}, [carregar]);

	if (carregando)
		return <p className="text-muted-foreground">Carregando…</p>;
	if (erro)
		return (
			<>
				<Alert variant="destructive" className="mb-4">
					<AlertDescription>{erro}</AlertDescription>
				</Alert>
				<Button variant="ghost" asChild>
					<Link to="/parceiros">← Voltar para parceiros</Link>
				</Button>
			</>
		);

	const p = parceiro;
	if (!p) return null;
	const e = p.endereco;

	const temFiltro =
		filtro.busca !== "" ||
		filtro.cpfcnpj !== "" ||
		filtro.cidade !== "" ||
		filtro.uf !== "";
	const paginaAtual = clientes?.page ?? 1;

	const onSubmit = (ev: FormEvent) => {
		ev.preventDefault();
		void carregarClientes(p.id, filtro, 1);
	};

	const onLimpar = () => {
		setFiltro(FILTRO_VAZIO);
		void carregarClientes(p.id, FILTRO_VAZIO, 1);
	};

	return (
		<div>
			<div className="mb-4 flex items-center gap-2">
				<Button variant="ghost" asChild>
					<Link to="/parceiros">← Voltar para parceiros</Link>
				</Button>
				<Button asChild>
					<Link to={`/emitir?parceiroId=${p.id}`}>Emitir fatura</Link>
				</Button>
			</div>

			<Card className="mb-4">
				<CardHeader>
					<CardTitle className="text-xl">Parceiro {p.id}</CardTitle>
				</CardHeader>
				<CardContent>
					<dl className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-x-6 gap-y-2.5">
						<div>
							<dt className="text-xs uppercase tracking-wide text-muted-foreground">
								Razão social
							</dt>
							<dd className="mb-1 font-medium">{p.razaoSocial}</dd>
						</div>
						<div>
							<dt className="text-xs uppercase tracking-wide text-muted-foreground">
								Fantasia
							</dt>
							<dd className="mb-1 font-medium">{p.fantasia ?? "—"}</dd>
						</div>
						<div>
							<dt className="text-xs uppercase tracking-wide text-muted-foreground">
								CNPJ
							</dt>
							<dd className="mb-1 font-medium">{p.cnpj}</dd>
						</div>
						<div>
							<dt className="text-xs uppercase tracking-wide text-muted-foreground">
								Inscrição Estadual
							</dt>
							<dd className="mb-1 font-medium">{p.ie ?? "—"}</dd>
						</div>
						<div>
							<dt className="text-xs uppercase tracking-wide text-muted-foreground">
								Email faturamento
							</dt>
							<dd className="mb-1 font-medium">
								{p.emailFaturamento || "—"}
							</dd>
						</div>
						<div>
							<dt className="text-xs uppercase tracking-wide text-muted-foreground">
								Dia de vencimento
							</dt>
							<dd className="mb-1 font-medium">{p.diaVencimento}</dd>
						</div>
						<div>
							<dt className="text-xs uppercase tracking-wide text-muted-foreground">
								Endereço
							</dt>
							<dd className="mb-1 font-medium">
								{e.logradouro}, {e.numero} — {e.bairro}
								<br />
								{e.cidade}/{e.uf} — CEP {e.cep}
							</dd>
						</div>
					</dl>
				</CardContent>
			</Card>

			<h2 className="mb-3 text-lg font-semibold">Clientes</h2>

			<form
				className="mb-4 flex flex-wrap items-end gap-4 rounded-lg border bg-card p-4"
				onSubmit={onSubmit}
			>
				<div className="flex min-w-[160px] max-w-[260px] flex-1 flex-col gap-1.5">
					<Label>Nome / fantasia</Label>
					<Input
						placeholder="Busca por nome ou fantasia"
						value={filtro.busca}
						onChange={(ev) =>
							setFiltro((f) => ({ ...f, busca: ev.target.value }))
						}
					/>
				</div>
				<div className="flex min-w-[160px] max-w-[220px] flex-1 flex-col gap-1.5">
					<Label>CPF/CNPJ</Label>
					<Input
						placeholder="ex.: 529.982.247-25"
						value={filtro.cpfcnpj}
						onChange={(ev) =>
							setFiltro((f) => ({ ...f, cpfcnpj: ev.target.value }))
						}
					/>
				</div>
				<div className="flex min-w-[160px] max-w-[220px] flex-1 flex-col gap-1.5">
					<Label>Cidade</Label>
					<Input
						placeholder="ex.: Rio Rufino"
						value={filtro.cidade}
						onChange={(ev) =>
							setFiltro((f) => ({ ...f, cidade: ev.target.value }))
						}
					/>
				</div>
				<div className="flex min-w-[80px] max-w-[100px] flex-col gap-1.5">
					<Label>UF</Label>
					<Input
						placeholder="SC"
						maxLength={2}
						value={filtro.uf}
						onChange={(ev) =>
							setFiltro((f) => ({
								...f,
								uf: ev.target.value.toUpperCase().slice(0, 2),
							}))
						}
					/>
				</div>
				<div className="ml-auto flex gap-2">
					<Button type="submit" disabled={carregandoClientes}>
						{carregandoClientes ? "Buscando…" : "Buscar"}
					</Button>
					<Button
						type="button"
						variant="ghost"
						disabled={carregandoClientes || !temFiltro}
						onClick={onLimpar}
					>
						Limpar
					</Button>
				</div>
			</form>

			{erroClientes && (
				<Alert variant="destructive" className="mb-4">
					<AlertDescription>{erroClientes}</AlertDescription>
				</Alert>
			)}
			{clientes === null && !erroClientes && !carregandoClientes && (
				<p className="text-muted-foreground">Clientes indisponíveis.</p>
			)}
			{carregandoClientes && (
				<p className="text-muted-foreground">Carregando…</p>
			)}
			{!carregandoClientes && clientes !== null && clientes.total === 0 && (
				<p className="text-muted-foreground">
					{temFiltro
						? "Nenhum cliente encontrado para o filtro."
						: "Este parceiro não possui clientes ativos."}
				</p>
			)}
			{!carregandoClientes && clientes !== null && clientes.itens.length > 0 && (
				<>
					<div className="overflow-x-auto rounded-lg border bg-card">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Cliente</TableHead>
									<TableHead>CPF/CNPJ</TableHead>
									<TableHead>Cidade/UF</TableHead>
									<TableHead>Linhas</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{clientes.itens.map((c) => (
									<TableRow key={c.id}>
										<TableCell>
											{c.nome}
											{c.fantasia ? ` (${c.fantasia})` : ""}
										</TableCell>
										<TableCell>{c.cpfcnpj}</TableCell>
										<TableCell>
											{c.endereco.cidade}/{c.endereco.uf}
										</TableCell>
										<TableCell>
											{c.linhas.map((l) => (
												<div key={l.planoId}>
													{l.descricao} · qtd {formatQtd(l.quantidade)} ·{" "}
													<MoneyReais value={l.unitario} />
												</div>
											))}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>

					{clientes.totalPaginas > 1 && (
						<div className="mt-3 flex items-center justify-center gap-3">
							<Button
								variant="ghost"
								size="sm"
								disabled={paginaAtual <= 1}
								onClick={() =>
									void carregarClientes(p.id, filtro, paginaAtual - 1)
								}
							>
								← Anterior
							</Button>
							<span className="text-muted-foreground">
								Página {clientes.page} de {clientes.totalPaginas} (
								{clientes.total} clientes)
							</span>
							<Button
								variant="ghost"
								size="sm"
								disabled={paginaAtual >= clientes.totalPaginas}
								onClick={() =>
									void carregarClientes(p.id, filtro, paginaAtual + 1)
								}
							>
								Próxima →
							</Button>
						</div>
					)}
				</>
			)}
		</div>
	);
}
