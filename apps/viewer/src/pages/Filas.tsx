import type { VariantProps } from "class-variance-authority";
import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge, type badgeVariants } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ApiError, listFilas } from "../api";
import { formatDataHora, formatHora } from "../format";
import type { EstadoJobFila, FilasSnapshot, FilaView, JobFila } from "../types";

const INTERVALO_MS = 3_000;

type VariantBadge = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

const ESTADO_BADGE: Record<
	EstadoJobFila,
	{ label: string; variant: VariantBadge; className?: string }
> = {
	waiting: { label: "Aguardando", variant: "secondary" },
	active: {
		label: "Em curso",
		variant: "outline",
		className: "border-blue-500/50 text-blue-700 dark:text-blue-400",
	},
	delayed: {
		label: "Atrasado",
		variant: "outline",
		className: "border-yellow-500/50 text-yellow-700 dark:text-yellow-400",
	},
	failed: { label: "Falhou", variant: "destructive" },
	completed: {
		label: "Concluído",
		variant: "outline",
		className: "border-green-500/50 text-green-700 dark:text-green-400",
	},
};

const CONTAGENS: { chave: string; label: string }[] = [
	{ chave: "waiting", label: "Aguardando" },
	{ chave: "active", label: "Em curso" },
	{ chave: "delayed", label: "Atrasados" },
	{ chave: "paused", label: "Pausados" },
	{ chave: "failed", label: "Falhos" },
	{ chave: "completed", label: "Concluídos" },
];

function JobBadge({ estado }: { estado: EstadoJobFila }) {
	const css = ESTADO_BADGE[estado];
	return (
		<Badge variant={css.variant} className={css.className}>
			{css.label}
		</Badge>
	);
}

function CartaoFila({ fila }: { fila: FilaView }) {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-base">
					{fila.nome}
					{fila.pausada && <Badge variant="secondary">pausada</Badge>}
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3">
				<p className="text-sm text-muted-foreground">
					{fila.workers} {fila.workers === 1 ? "worker" : "workers"}
				</p>
				<div className="flex flex-wrap gap-1.5">
					{CONTAGENS.map(({ chave, label }) => (
						<Badge key={chave} variant="secondary" className="tabular-nums">
							{label}: {fila.contagens[chave] ?? 0}
						</Badge>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

export function Filas() {
	const [snapshot, setSnapshot] = useState<FilasSnapshot | null>(null);
	const [carregando, setCarregando] = useState(true);
	const [erro, setErro] = useState<string | null>(null);
	const [autoAtualiza, setAutoAtualiza] = useState(true);
	const [filtroFila, setFiltroFila] = useState("todas");
	const [filtroEstado, setFiltroEstado] = useState("todos");
	const [busca, setBusca] = useState("");
	const [detalhe, setDetalhe] = useState<(JobFila & { fila: string }) | null>(
		null,
	);

	// Poll periódico (o "tempo real" do painel): 3s enquanto a página está
	// montada e a atualização automática está ligada. `ativo` evita setState
	// após o unmount; na 1ª carga mostra o spinner, nas seguintes atualiza
	// no lugar (sem flicker).
	useEffect(() => {
		if (!autoAtualiza) return;
		let ativo = true;
		const carregar = async () => {
			try {
				const snap = await listFilas();
				if (!ativo) return;
				setSnapshot(snap);
				setErro(null);
			} catch (err) {
				if (!ativo) return;
				setErro(
					err instanceof ApiError
						? err.mensagem
						: "Erro inesperado ao carregar as filas.",
				);
			} finally {
				if (ativo) setCarregando(false);
			}
		};
		void carregar();
		const timer = setInterval(() => void carregar(), INTERVALO_MS);
		return () => {
			ativo = false;
			clearInterval(timer);
		};
	}, [autoAtualiza]);

	const linhas = useMemo(() => {
		if (!snapshot) return [] as (JobFila & { fila: string })[];
		const q = busca.trim().toLowerCase();
		const rows: (JobFila & { fila: string })[] = [];
		for (const fila of snapshot.filas) {
			for (const job of fila.jobs) {
				if (filtroFila !== "todas" && fila.nome !== filtroFila) continue;
				if (filtroEstado !== "todos" && job.estado !== filtroEstado) continue;
				if (q) {
					const alvo =
						`${job.id} ${job.nome} ${job.faturaId ?? ""}`.toLowerCase();
					if (!alvo.includes(q)) continue;
				}
				rows.push({ ...job, fila: fila.nome });
			}
		}
		return rows;
	}, [snapshot, filtroFila, filtroEstado, busca]);

	const nomesFilas = snapshot?.filas.map((f) => f.nome) ?? [];

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-xl font-semibold">Filas</h1>
				<div className="flex items-center gap-4">
					{snapshot && (
						<span className="flex items-center gap-2 text-sm text-muted-foreground">
							<span
								className={cn(
									"size-2 rounded-full",
									autoAtualiza
										? "animate-pulse bg-green-500"
										: "bg-muted-foreground/40",
								)}
							/>
							{autoAtualiza
								? `ao vivo · atualizado ${formatHora(snapshot.geradoEm)}`
								: `pausado · atualizado ${formatHora(snapshot.geradoEm)}`}
						</span>
					)}
					<span className="flex items-center gap-2">
						<Label htmlFor="auto-atualiza" className="text-sm">
							Auto
						</Label>
						<Switch
							id="auto-atualiza"
							checked={autoAtualiza}
							onCheckedChange={setAutoAtualiza}
						/>
					</span>
				</div>
			</div>

			{erro && (
				<Alert variant="destructive" role="alert">
					<AlertDescription>
						{erro}
						{snapshot ? " (mostrando o último snapshot)" : ""}
					</AlertDescription>
				</Alert>
			)}

			{carregando ? (
				<div className="flex items-center gap-3 text-muted-foreground">
					<Spinner /> Carregando filas…
				</div>
			) : (
				<>
					{snapshot && (
						<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
							{snapshot.filas.map((fila) => (
								<CartaoFila key={fila.nome} fila={fila} />
							))}
						</div>
					)}

					<form className="flex flex-wrap items-end gap-4 rounded-lg border bg-card p-4">
						<div className="flex min-w-[140px] max-w-[200px] flex-col gap-1.5">
							<Label>Fila</Label>
							<Select value={filtroFila} onValueChange={setFiltroFila}>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="todas">Todas</SelectItem>
									{nomesFilas.map((nome) => (
										<SelectItem key={nome} value={nome}>
											{nome}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="flex min-w-[140px] max-w-[200px] flex-col gap-1.5">
							<Label>Estado</Label>
							<Select value={filtroEstado} onValueChange={setFiltroEstado}>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="todos">Todos</SelectItem>
									{(Object.keys(ESTADO_BADGE) as EstadoJobFila[]).map((e) => (
										<SelectItem key={e} value={e}>
											{ESTADO_BADGE[e].label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="flex min-w-[180px] max-w-[280px] flex-1 flex-col gap-1.5">
							<Label>Buscar (id / nome / fatura)</Label>
							<Input
								placeholder="ex.: 101 ou emit-nfcom"
								value={busca}
								onChange={(e) => setBusca(e.target.value)}
							/>
						</div>
					</form>

					{snapshot && linhas.length === 0 && (
						<p className="text-muted-foreground">Nenhum job encontrado.</p>
					)}

					{snapshot && linhas.length > 0 && (
						<div className="overflow-x-auto rounded-lg border bg-card">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Fila</TableHead>
										<TableHead>Job</TableHead>
										<TableHead>Nome</TableHead>
										<TableHead>Fatura</TableHead>
										<TableHead>Estado</TableHead>
										<TableHead className="text-right">Tent.</TableHead>
										<TableHead>Criado em</TableHead>
										<TableHead>Atualizado em</TableHead>
										<TableHead aria-label="Detalhes" />
									</TableRow>
								</TableHeader>
								<TableBody>
									{linhas.map((job) => (
										<TableRow key={`${job.fila}:${job.id}`}>
											<TableCell>{job.fila}</TableCell>
											<TableCell className="font-mono text-sm">
												{job.id}
											</TableCell>
											<TableCell>{job.nome}</TableCell>
											<TableCell>{job.faturaId ?? "—"}</TableCell>
											<TableCell>
												<JobBadge estado={job.estado} />
											</TableCell>
											<TableCell className="text-right tabular-nums">
												{job.tentativas}
											</TableCell>
											<TableCell className="whitespace-nowrap tabular-nums">
												{formatDataHora(job.criadoEm)}
											</TableCell>
											<TableCell className="whitespace-nowrap tabular-nums">
												{formatDataHora(job.finalizadoEm ?? job.processadoEm)}
											</TableCell>
											<TableCell>
												<button
													type="button"
													className={buttonVariants({
														variant: "ghost",
														size: "sm",
													})}
													onClick={() => setDetalhe(job)}
												>
													Ver
												</button>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					)}
				</>
			)}

			<Dialog
				open={detalhe !== null}
				onOpenChange={(aberto) => !aberto && setDetalhe(null)}
			>
				<DialogContent className="max-w-lg">
					<DialogHeader>
						<DialogTitle>
							Job {detalhe?.id} — {detalhe?.nome}
						</DialogTitle>
						<DialogDescription>Fila {detalhe?.fila}</DialogDescription>
					</DialogHeader>
					{detalhe && (
						<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
							<dt className="text-muted-foreground">Estado</dt>
							<dd>
								<JobBadge estado={detalhe.estado} />
							</dd>
							<dt className="text-muted-foreground">Fatura</dt>
							<dd>{detalhe.faturaId ?? "—"}</dd>
							<dt className="text-muted-foreground">Tentativas</dt>
							<dd className="tabular-nums">{detalhe.tentativas}</dd>
							<dt className="text-muted-foreground">Criado em</dt>
							<dd className="tabular-nums">
								{formatDataHora(detalhe.criadoEm)}
							</dd>
							<dt className="text-muted-foreground">Processado em</dt>
							<dd className="tabular-nums">
								{formatDataHora(detalhe.processadoEm)}
							</dd>
							<dt className="text-muted-foreground">Finalizado em</dt>
							<dd className="tabular-nums">
								{formatDataHora(detalhe.finalizadoEm)}
							</dd>
							<dt className="text-muted-foreground">Job pai</dt>
							<dd className="font-mono">{detalhe.paiId ?? "—"}</dd>
						</dl>
					)}
					{detalhe?.falha && (
						<pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-md bg-destructive/10 p-3 text-xs text-destructive">
							{detalhe.falha}
						</pre>
					)}
				</DialogContent>
			</Dialog>
		</div>
	);
}
