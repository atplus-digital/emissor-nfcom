import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, listParceiros } from "../api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { ParceiroResumo } from "../types";

export function Parceiros() {
	const [parceiros, setParceiros] = useState<ParceiroResumo[]>([]);
	const [carregando, setCarregando] = useState(true);
	const [erro, setErro] = useState<string | null>(null);
	const [buscou, setBuscou] = useState(false);

	const carregar = useCallback(async () => {
		setCarregando(true);
		setErro(null);
		try {
			const lista = await listParceiros();
			// Ordenação alfabética pela razão social.
			lista.sort((a, b) => a.razaoSocial.localeCompare(b.razaoSocial, "pt-BR"));
			setParceiros(lista);
		} catch (err) {
			setErro(
				err instanceof ApiError
					? err.mensagem
					: "Erro inesperado ao carregar parceiros.",
			);
			setParceiros([]);
		} finally {
			setCarregando(false);
			setBuscou(true);
		}
	}, []);

	// Busca inicial.
	useEffect(() => {
		void carregar();
	}, [carregar]);

	return (
		<div>
			<h1 className="mb-4 text-xl">Parceiros</h1>

			{erro && (
				<Alert variant="destructive" className="mb-4">
					<AlertDescription>{erro}</AlertDescription>
				</Alert>
			)}

			{!carregando && buscou && !erro && parceiros.length === 0 && (
				<p className="text-muted-foreground">Nenhum parceiro encontrado.</p>
			)}

			{carregando && (
				<p className="text-muted-foreground">Carregando…</p>
			)}

			{!carregando && !erro && parceiros.length > 0 && (
				<div className="overflow-x-auto rounded-lg border bg-card">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Parceiro</TableHead>
								<TableHead>Razão social</TableHead>
								<TableHead>Fantasia</TableHead>
								<TableHead>CNPJ</TableHead>
								<TableHead aria-label="Ações" />
							</TableRow>
						</TableHeader>
						<TableBody>
							{parceiros.map((p) => (
								<TableRow key={p.id}>
									<TableCell>{p.id}</TableCell>
									<TableCell>{p.razaoSocial}</TableCell>
									<TableCell>{p.fantasia ?? "—"}</TableCell>
									<TableCell>{p.cnpj}</TableCell>
									<TableCell>
										<Button variant="ghost" size="sm" asChild>
											<Link to={`/parceiros/${p.id}`}>Ver</Link>
										</Button>
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
