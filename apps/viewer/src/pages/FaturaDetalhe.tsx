import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	ApiError,
	emitirFatura,
	getEmissao,
	getFatura,
	getParceiro,
} from "../api";
import { MoneyReais } from "../components/Money";
import { StatusBadge } from "../components/StatusBadge";
import { formatAliq, formatData, formatQtd } from "../format";
import type {
	CobrancaView,
	EmissaoView,
	FaturaDetalhe as FaturaDetalheType,
	NotaView,
} from "../types";

interface Estado {
	fatura: FaturaDetalheType | null;
	emissao: EmissaoView | null;
	erro: string | null;
}

export function FaturaDetalhe() {
	const { id } = useParams<{ id: string }>();
	const [estado, setEstado] = useState<Estado>({
		fatura: null,
		emissao: null,
		erro: null,
	});
	const [carregando, setCarregando] = useState(true);
	const [erroEmissao, setErroEmissao] = useState<string | null>(null);
	// Emissão da fatura (disparo assíncrono via POST /emitir, com confirmação).
	const [dialogEmissao, setDialogEmissao] = useState(false);
	const [emitindo, setEmitindo] = useState(false);
	const [erroEmitir, setErroEmitir] = useState<string | null>(null);
	// Nome do parceiro (complementar — falha não derruba o detalhe).
	const [parceiroNome, setParceiroNome] = useState<string | null>(null);

	const carregar = useCallback(async () => {
		if (!id) return;
		setCarregando(true);
		setErroEmissao(null);
		setParceiroNome(null);
		try {
			const fatura = await getFatura(id);
			// Nome do parceiro é complementar — falha não derruba o detalhe.
			const parceiro = await getParceiro(fatura.parceiroId).catch(() => null);
			setParceiroNome(parceiro ? parceiro.razaoSocial : null);
			// Emissão é complementar — falha nela não derruba o detalhe.
			const emissao = await getEmissao(id).catch((err: unknown) => {
				setErroEmissao(
					err instanceof ApiError
						? err.mensagem
						: "Seção de emissão indisponível.",
				);
				return null;
			});
			setEstado({ fatura, emissao, erro: null });
		} catch (err) {
			setEstado({
				fatura: null,
				emissao: null,
				erro:
					err instanceof ApiError
						? err.mensagem
						: "Erro inesperado ao carregar a fatura.",
			});
		} finally {
			setCarregando(false);
		}
	}, [id]);

	useEffect(() => {
		void carregar();
	}, [carregar]);

	const onConfirmarEmissao = useCallback(async () => {
		if (!id || emitindo) return;
		setErroEmitir(null);
		setEmitindo(true);
		try {
			await emitirFatura(id);
			setDialogEmissao(false);
			// Atualiza o detalhe — a seção de emissão passa a refletir o job.
			await carregar();
		} catch (err) {
			setErroEmitir(
				err instanceof ApiError
					? err.mensagem
					: "Erro inesperado ao emitir a fatura.",
			);
		} finally {
			setEmitindo(false);
		}
	}, [carregar, emitindo, id]);

	if (carregando) return <p className="text-muted-foreground">Carregando…</p>;
	if (estado.erro)
		return (
			<>
				<Alert variant="destructive">
					<AlertDescription>{estado.erro}</AlertDescription>
				</Alert>
				<Button asChild variant="ghost">
					<Link to="/">← Voltar para faturas</Link>
				</Button>
			</>
		);

	const fatura = estado.fatura;
	if (!fatura) return null;

	return (
		<div>
			<Button asChild variant="ghost">
				<Link to="/">← Voltar para faturas</Link>
			</Button>

			<Card className="mb-4">
				<CardHeader>
					<CardTitle>Fatura {fatura.id}</CardTitle>
					<StatusBadge escopo="fatura" value={fatura.status} />
				</CardHeader>
				<CardContent>
					<dl className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-x-6 gap-y-2.5">
						<div>
							<dt className="text-xs uppercase tracking-wide text-muted-foreground">
								Parceiro
							</dt>
							<dd className="font-medium mb-1">
								{parceiroNome
									? `${parceiroNome} (${fatura.parceiroId})`
									: fatura.parceiroId}
							</dd>
						</div>
						<div>
							<dt className="text-xs uppercase tracking-wide text-muted-foreground">
								Referência
							</dt>
							<dd className="font-medium mb-1">
								{formatData(fatura.dataReferencia)}
							</dd>
						</div>
						<div>
							<dt className="text-xs uppercase tracking-wide text-muted-foreground">
								Vencimento
							</dt>
							<dd className="font-medium mb-1">
								{formatData(fatura.dataVencimento)}
							</dd>
						</div>
						<div>
							<dt className="text-xs uppercase tracking-wide text-muted-foreground">
								Tipo
							</dt>
							<dd className="font-medium mb-1">{fatura.tipoFaturamento}</dd>
						</div>
						<div>
							<dt className="text-xs uppercase tracking-wide text-muted-foreground">
								Valor total
							</dt>
							<dd className="font-medium mb-1">
								<MoneyReais value={fatura.valorTotal} />
							</dd>
						</div>
						<div>
							<dt className="text-xs uppercase tracking-wide text-muted-foreground">
								Cobranças
							</dt>
							<dd className="font-medium mb-1">
								{(fatura.cobrancas ?? []).length}
							</dd>
						</div>
					</dl>
				</CardContent>
			</Card>

			{fatura.status === "a-emitir" && (
				<Card className="mb-4">
					<CardHeader>
						<CardTitle className="text-base">Emitir fatura</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-center justify-between gap-4 flex-wrap">
							<p className="text-sm text-muted-foreground">
								A fatura está preparada. Ao confirmar, as notas serão enviadas
								para emissão (processamento assíncrono).
							</p>
							<Button
								disabled={emitindo}
								onClick={() => setDialogEmissao(true)}
							>
								Emitir fatura
							</Button>
						</div>
						{erroEmitir && (
							<Alert variant="destructive" className="mt-3">
								<AlertDescription>{erroEmitir}</AlertDescription>
							</Alert>
						)}
					</CardContent>
				</Card>
			)}

			<AlertDialog
				open={dialogEmissao}
				onOpenChange={(aberto) => {
					if (!emitindo) setDialogEmissao(aberto);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Confirmar emissão</AlertDialogTitle>
						<AlertDialogDescription>
							Isto envia as notas da fatura {fatura.id} para emissão via SEFAZ.
							A ação é assíncrona — o status atualiza aqui mesmo, na seção de
							emissão.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={emitindo}>Cancelar</AlertDialogCancel>
						<Button
							disabled={emitindo}
							onClick={() => void onConfirmarEmissao()}
						>
							{emitindo ? "Enviando…" : "Confirmar emissão"}
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<h2 className="text-[1.15rem] mt-7 mb-3">Cobranças</h2>
			{(fatura.cobrancas ?? []).length === 0 && (
				<p className="text-muted-foreground">
					Esta fatura não possui cobranças.
				</p>
			)}
			{(fatura.cobrancas ?? []).map((c) => (
				<Cobranca key={c.id} cobranca={c} />
			))}

			<h2 className="text-[1.15rem] mt-7 mb-3">Emissão</h2>
			{estado.emissao === null ? (
				erroEmissao ? (
					<Alert variant="destructive">
						<AlertDescription>{erroEmissao}</AlertDescription>
					</Alert>
				) : (
					<p className="text-muted-foreground">Emissão indisponível.</p>
				)
			) : (
				<SecaoEmissao emissao={estado.emissao} />
			)}
		</div>
	);
}

function Cobranca({ cobranca }: { cobranca: CobrancaView }) {
	return (
		<Card className="mb-4">
			<CardHeader>
				<CardTitle className="text-base">Cobrança {cobranca.id}</CardTitle>
				<StatusBadge escopo="cobranca" value={cobranca.status} />
			</CardHeader>
			<CardContent>
				<dl className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-x-6 gap-y-2.5">
					<div>
						<dt className="text-xs uppercase tracking-wide text-muted-foreground">
							Devedor
						</dt>
						<dd className="font-medium mb-1">{cobranca.nomeDevedor}</dd>
					</div>
					<div>
						<dt className="text-xs uppercase tracking-wide text-muted-foreground">
							Documento
						</dt>
						<dd className="font-medium mb-1">{cobranca.documentoDevedor}</dd>
					</div>
					<div>
						<dt className="text-xs uppercase tracking-wide text-muted-foreground">
							Vencimento
						</dt>
						<dd className="font-medium mb-1">
							{formatData(cobranca.dataVencimento)}
						</dd>
					</div>
					<div>
						<dt className="text-xs uppercase tracking-wide text-muted-foreground">
							Valor
						</dt>
						<dd className="font-medium mb-1">
							<MoneyReais value={cobranca.valorTotal} />
						</dd>
					</div>
				</dl>
				{cobranca.boletoUrl && (
					<div className="flex gap-1.5 flex-wrap">
						<Button asChild size="sm">
							<a href={cobranca.boletoUrl} target="_blank" rel="noreferrer">
								Ver boleto
							</a>
						</Button>
						<Button asChild size="sm">
							<a href={cobranca.boletoUrl} target="_blank" rel="noreferrer">
								📄 Fatura Asaas (PDF)
							</a>
						</Button>
					</div>
				)}

				{(cobranca.notas ?? []).length === 0 ? (
					<p className="text-muted-foreground">Sem notas nesta cobrança.</p>
				) : (
					cobranca.notas?.map((n) => <Nota key={n.id} nota={n} />)
				)}
			</CardContent>
		</Card>
	);
}

function Nota({ nota }: { nota: NotaView }) {
	return (
		<article className="border rounded-lg p-4 mt-4 bg-background">
			<div className="flex items-center justify-between gap-4 flex-wrap mb-3">
				<h4 className="text-[0.95rem]">
					Nota {nota.numero}
					{nota.serie ? ` — série ${nota.serie}` : ""} · {nota.nome}
				</h4>
				<div className="flex gap-1.5 flex-wrap">
					<StatusBadge escopo="nota" value={nota.statusInterno} />
					<StatusBadge escopo="situacao" value={nota.situacao} />
					{nota.pdfUrl && (
						<Button asChild size="sm">
							<a href={nota.pdfUrl} target="_blank" rel="noreferrer">
								📄 Ver PDF
							</a>
						</Button>
					)}
				</div>
			</div>
			<dl className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-x-6 gap-y-2.5">
				<div>
					<dt className="text-xs uppercase tracking-wide text-muted-foreground">
						CPF/CNPJ
					</dt>
					<dd className="font-medium mb-1">{nota.cpfcnpj}</dd>
				</div>
				<div>
					<dt className="text-xs uppercase tracking-wide text-muted-foreground">
						Chave
					</dt>
					<dd className="font-mono text-[0.82em] break-all [overflow-wrap:anywhere]">
						{nota.chave || "—"}
					</dd>
				</div>
				<div>
					<dt className="text-xs uppercase tracking-wide text-muted-foreground">
						Protocolo
					</dt>
					<dd className="break-all [overflow-wrap:anywhere]">
						{nota.protocolo || "—"}
					</dd>
				</div>
				<div>
					<dt className="text-xs uppercase tracking-wide text-muted-foreground">
						Total
					</dt>
					<dd className="font-medium mb-1">
						<MoneyReais value={nota.total} />
					</dd>
				</div>
			</dl>

			{(nota.itens ?? []).length > 0 && (
				<div className="overflow-x-auto max-w-full border rounded-lg bg-card mt-3">
					<Table className="text-sm">
						<TableHeader>
							<TableRow>
								<TableHead>Item</TableHead>
								<TableHead>Código</TableHead>
								<TableHead>Descrição</TableHead>
								<TableHead>CFOP</TableHead>
								<TableHead>CClass</TableHead>
								<TableHead>Qtd</TableHead>
								<TableHead className="text-right">Unitário</TableHead>
								<TableHead className="text-right">Total</TableHead>
								<TableHead className="text-right">Alíq. ICMS</TableHead>
								<TableHead className="text-right">ICMS</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{(nota.itens ?? []).map((i, idx) => (
								<TableRow key={`${i.item}-${idx}`}>
									<TableCell>{i.item}</TableCell>
									<TableCell>{i.codigo || "—"}</TableCell>
									<TableCell>{i.descricao}</TableCell>
									<TableCell>{i.cfop}</TableCell>
									<TableCell>{i.cclass}</TableCell>
									<TableCell className="text-right tabular-nums">
										{formatQtd(i.quantidade)}
									</TableCell>
									<TableCell className="text-right tabular-nums">
										<MoneyReais value={i.unitario} />
									</TableCell>
									<TableCell className="text-right tabular-nums">
										<MoneyReais value={i.total} />
									</TableCell>
									<TableCell className="text-right tabular-nums">
										{formatAliq(i.aliqIcms)}
									</TableCell>
									<TableCell className="text-right tabular-nums">
										<MoneyReais value={i.icms} />
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			)}
		</article>
	);
}

function SecaoEmissao({ emissao }: { emissao: EmissaoView }) {
	return (
		<Card className="mb-4">
			<CardHeader>
				<CardTitle className="text-base">Status da emissão</CardTitle>
				<StatusBadge escopo="fatura" value={emissao.status} />
			</CardHeader>
			<CardContent>
				<div className="overflow-x-auto max-w-full border rounded-lg bg-card">
					<Table className="text-sm">
						<TableHeader>
							<TableRow>
								<TableHead>Cobrança</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Nota</TableHead>
								<TableHead>Situação SEFAZ</TableHead>
								<TableHead>Chave</TableHead>
								<TableHead>Protocolo</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{(emissao.cobrancas ?? []).flatMap((c) =>
								(c.notas ?? []).length === 0
									? [
											<TableRow key={`c${c.id}`}>
												<TableCell>{c.id}</TableCell>
												<TableCell>
													<StatusBadge escopo="cobranca" value={c.status} />
												</TableCell>
												<TableCell
													className="text-muted-foreground"
													colSpan={4}
												>
													Sem notas
												</TableCell>
											</TableRow>,
										]
									: (c.notas ?? []).map((n) => (
											<TableRow key={`c${c.id}-n${n.id}`}>
												<TableCell>{c.id}</TableCell>
												<TableCell>
													<StatusBadge escopo="cobranca" value={c.status} />
												</TableCell>
												<TableCell>{n.id}</TableCell>
												<TableCell>
													<StatusBadge escopo="situacao" value={n.situacao} />
												</TableCell>
												<TableCell className="font-mono text-[0.82em] break-all [overflow-wrap:anywhere]">
													{n.chave || "—"}
												</TableCell>
												<TableCell className="font-mono text-[0.82em] break-all [overflow-wrap:anywhere]">
													{n.protocolo || "—"}
												</TableCell>
											</TableRow>
										)),
							)}
						</TableBody>
					</Table>
				</div>

				{(emissao.erros ?? []).length > 0 ? (
					<>
						<h4 className="text-[0.95rem] mt-4 mb-3">Erros</h4>
						<div className="overflow-x-auto max-w-full border rounded-lg bg-card">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Erro</TableHead>
										<TableHead>Cobrança</TableHead>
										<TableHead>Nota</TableHead>
										<TableHead>Status HTTP</TableHead>
										<TableHead>Mensagem</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{(emissao.erros ?? []).map((e) => (
										<TableRow key={e.id}>
											<TableCell>{e.erro}</TableCell>
											<TableCell>{e.cobrancaId}</TableCell>
											<TableCell>{e.notaId}</TableCell>
											<TableCell className="text-right tabular-nums">
												{e.statusCode}
											</TableCell>
											<TableCell>{e.mensagem}</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					</>
				) : (
					<p className="text-muted-foreground mt-3">Nenhum erro registrado.</p>
				)}
			</CardContent>
		</Card>
	);
}
