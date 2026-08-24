import { useCallback, useEffect, useState } from "react";
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
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type {
	ClienteView,
	ParceiroDetalhe as ParceiroDetalheType,
} from "../types";

export function ParceiroDetalhe() {
	const { id } = useParams<{ id: string }>();
	const [parceiro, setParceiro] = useState<ParceiroDetalheType | null>(null);
	const [clientes, setClientes] = useState<ClienteView[] | null>(null);
	const [erro, setErro] = useState<string | null>(null);
	const [erroClientes, setErroClientes] = useState<string | null>(null);
	const [carregando, setCarregando] = useState(true);

	const carregar = useCallback(async () => {
		if (!id) return;
		setCarregando(true);
		setErro(null);
		setErroClientes(null);
		try {
			const p = await getParceiro(id);
			setParceiro(p);
			// Clientes é complementar — falha nele não derruba o detalhe.
			const cl = await listClientes(p.id).catch((err: unknown) => {
				setErroClientes(
					err instanceof ApiError
						? err.mensagem
						: "Não foi possível carregar os clientes.",
				);
				return null;
			});
			setClientes(cl);
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
	}, [id]);

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
			{erroClientes && (
				<Alert variant="destructive" className="mb-4">
					<AlertDescription>{erroClientes}</AlertDescription>
				</Alert>
			)}
			{clientes === null && !erroClientes && (
				<p className="text-muted-foreground">Clientes indisponíveis.</p>
			)}
			{clientes !== null && clientes.length === 0 && (
				<p className="text-muted-foreground">
					Este parceiro não possui clientes ativos.
				</p>
			)}
			{clientes !== null && clientes.length > 0 && (
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
							{clientes.map((c) => (
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
			)}
		</div>
	);
}
