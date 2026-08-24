import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldContent, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { ApiError, listParceiros, prepararFatura } from "../api";
import type { ParceiroResumo, TipoFaturamento } from "../types";

const TIPO_OPCOES: { value: TipoFaturamento; label: string }[] = [
	{ value: "parceiro", label: "Parceiro" },
	{ value: "via-parceiro", label: "Via parceiro" },
	{ value: "cofaturamento", label: "Cofaturamento" },
	{ value: "cliente-final", label: "Cliente final" },
];

/** Primeira data do mês atual (YYYY-MM-01) no fuso local do navegador. */
function primeiraDataDoMesAtual(): string {
	const agora = new Date();
	const mes = String(agora.getMonth() + 1).padStart(2, "0");
	return `${agora.getFullYear()}-${mes}-01`;
}

export function EmitirFatura() {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();

	const [parceiros, setParceiros] = useState<ParceiroResumo[]>([]);
	const [parceirosErro, setParceirosErro] = useState<string | null>(null);
	const [parceiroId, setParceiroId] = useState<string>(
		() => searchParams.get("parceiroId") ?? "",
	);
	const [dataReferencia, setDataReferencia] = useState<string>(() =>
		primeiraDataDoMesAtual(),
	);
	const [tipoFaturamento, setTipoFaturamento] =
		useState<TipoFaturamento>("parceiro");
	const [preparando, setPreparando] = useState(false);
	const [erro, setErro] = useState<string | null>(null);

	// Carrega os parceiros do seletor (uma vez).
	useEffect(() => {
		listParceiros()
			.then((lista) => {
				lista.sort((a, b) =>
					a.razaoSocial.localeCompare(b.razaoSocial, "pt-BR"),
				);
				setParceiros(lista);
			})
			.catch((err: unknown) => {
				setParceirosErro(
					err instanceof ApiError
						? err.mensagem
						: "Erro inesperado ao carregar parceiros.",
				);
			});
	}, []);

	const onPreparar = useCallback(
		async (e: FormEvent) => {
			e.preventDefault();
			// Validação mínima — a fonte da verdade é o backend.
			if (!parceiroId || !dataReferencia) return;
			setErro(null);
			setPreparando(true);
			try {
				const res = await prepararFatura({
					parceiroId: Number(parceiroId),
					dataReferencia,
					tipoFaturamento,
				});
				// A fatura foi preparada e persistida — vai direto para a
				// tela da fatura (a emissão é disparada de lá, com confirmação).
				navigate(`/faturas/${res.faturaId}`);
			} catch (err) {
				setErro(
					err instanceof ApiError
						? err.mensagem
						: "Erro inesperado ao preparar a fatura.",
				);
			} finally {
				setPreparando(false);
			}
		},
		[navigate, parceiroId, dataReferencia, tipoFaturamento],
	);

	return (
		<div>
			<h1 className="text-[1.4rem] mb-4">Nova fatura</h1>

			{parceirosErro && (
				<Alert variant="destructive">
					<AlertDescription>{parceirosErro}</AlertDescription>
				</Alert>
			)}

			{erro && (
				<Alert variant="destructive">
					<AlertDescription>{erro}</AlertDescription>
				</Alert>
			)}

			<form
				className="bg-card border rounded-lg p-4 sm:p-6 mb-4"
				onSubmit={onPreparar}
			>
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_auto] lg:items-end">
					<Field>
						<FieldLabel htmlFor="parceiro">Parceiro</FieldLabel>
						<FieldContent>
							<Select
								value={parceiroId}
								onValueChange={(v) => setParceiroId(v)}
							>
								<SelectTrigger id="parceiro">
									<SelectValue placeholder="Selecione…" />
								</SelectTrigger>
								<SelectContent>
									{parceiros.map((p) => (
										<SelectItem key={p.id} value={String(p.id)}>
											{p.razaoSocial} ({p.cnpj})
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</FieldContent>
					</Field>
					<Field>
						<FieldLabel htmlFor="dataReferencia">Referência</FieldLabel>
						<FieldContent>
							<Input
								id="dataReferencia"
								type="date"
								value={dataReferencia}
								onChange={(e) => setDataReferencia(e.target.value)}
							/>
						</FieldContent>
					</Field>
					<Field>
						<FieldLabel htmlFor="tipoFaturamento">
							Tipo de faturamento
						</FieldLabel>
						<FieldContent>
							<Select
								value={tipoFaturamento}
								onValueChange={(v) => setTipoFaturamento(v as TipoFaturamento)}
							>
								<SelectTrigger id="tipoFaturamento">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{TIPO_OPCOES.map((o) => (
										<SelectItem key={o.value} value={o.value}>
											{o.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</FieldContent>
					</Field>
					<div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
						<Button asChild variant="ghost">
							<Link to="/parceiros">← Cancelar</Link>
						</Button>
						<Button
							type="submit"
							disabled={preparando || !parceiroId || !dataReferencia}
						>
							{preparando ? "Preparando…" : "Preparar"}
						</Button>
					</div>
				</div>
			</form>
		</div>
	);
}
