import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError, getEmissao, getFatura } from "../api";
import { Money, MoneyReais } from "../components/Money";
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

	const carregar = useCallback(async () => {
		if (!id) return;
		setCarregando(true);
		setErroEmissao(null);
		try {
			const fatura = await getFatura(id);
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

	if (carregando) return <p className="muted">Carregando…</p>;
	if (estado.erro)
		return (
			<>
				<div className="alert alert-error" role="alert">
					{estado.erro}
				</div>
				<Link className="btn btn-ghost" to="/">
					← Voltar para faturas
				</Link>
			</>
		);

	const fatura = estado.fatura;
	if (!fatura) return null;

	return (
		<div>
			<Link className="btn btn-ghost" to="/">
				← Voltar para faturas
			</Link>

			<section className="card">
				<div className="card-header">
					<h1>Fatura {fatura.id}</h1>
					<StatusBadge escopo="fatura" value={fatura.status} />
				</div>
				<dl className="kv">
					<div>
						<dt>Parceiro</dt>
						<dd>{fatura.parceiroId}</dd>
					</div>
					<div>
						<dt>Referência</dt>
						<dd>{formatData(fatura.dataReferencia)}</dd>
					</div>
					<div>
						<dt>Vencimento</dt>
						<dd>{formatData(fatura.dataVencimento)}</dd>
					</div>
					<div>
						<dt>Tipo</dt>
						<dd>{fatura.tipoFaturamento}</dd>
					</div>
					<div>
						<dt>Valor total</dt>
						<dd>
							<MoneyReais value={fatura.valorTotal} />
						</dd>
					</div>
					<div>
						<dt>Cobranças</dt>
						<dd>{(fatura.cobrancas ?? []).length}</dd>
					</div>
				</dl>
			</section>

			<h2>Cobranças</h2>
			{(fatura.cobrancas ?? []).length === 0 && (
				<p className="muted">Esta fatura não possui cobranças.</p>
			)}
			{(fatura.cobrancas ?? []).map((c) => (
				<Cobranca key={c.id} cobranca={c} />
			))}

			<h2>Emissão</h2>
			{estado.emissao === null ? (
				erroEmissao ? (
					<div className="alert alert-error" role="alert">
						{erroEmissao}
					</div>
				) : (
					<p className="muted">Emissão indisponível.</p>
				)
			) : (
				<SecaoEmissao emissao={estado.emissao} />
			)}
		</div>
	);
}

function Cobranca({ cobranca }: { cobranca: CobrancaView }) {
	return (
		<section className="card">
			<div className="card-header">
				<h3>Cobrança {cobranca.id}</h3>
				<StatusBadge escopo="cobranca" value={cobranca.status} />
			</div>
			<dl className="kv">
				<div>
					<dt>Devedor</dt>
					<dd>{cobranca.nomeDevedor}</dd>
				</div>
				<div>
					<dt>Documento</dt>
					<dd>{cobranca.documentoDevedor}</dd>
				</div>
				<div>
					<dt>Vencimento</dt>
					<dd>{formatData(cobranca.dataVencimento)}</dd>
				</div>
				<div>
					<dt>Valor</dt>
					<dd>
						<Money cents={cobranca.valorTotal} />
					</dd>
				</div>
			</dl>
			{cobranca.boletoUrl && (
				<span className="badges">
					<a className="btn btn-small" href={cobranca.boletoUrl} target="_blank" rel="noreferrer">
						Ver boleto
					</a>
					<a className="btn btn-small" href={cobranca.boletoUrl} target="_blank" rel="noreferrer">
						📄 Fatura Asaas (PDF)
					</a>
				</span>
			)}

			{(cobranca.notas ?? []).length === 0 ? (
				<p className="muted">Sem notas nesta cobrança.</p>
			) : (
				cobranca.notas?.map((n) => <Nota key={n.id} nota={n} />)
			)}
		</section>
	);
}

function Nota({ nota }: { nota: NotaView }) {
	return (
		<article className="nota">
			<div className="card-header">
				<h4>
					Nota {nota.numero}
					{nota.serie ? ` — série ${nota.serie}` : ""} · {nota.nome}
				</h4>
				<span className="badges">
					<StatusBadge escopo="nota" value={nota.statusInterno} />
					<StatusBadge escopo="situacao" value={nota.situacao} />
					{nota.pdfUrl && (
						<a className="btn btn-small" href={nota.pdfUrl} target="_blank" rel="noreferrer">
							📄 Ver PDF
						</a>
					)}
				</span>
			</div>
			<dl className="kv">
				<div>
					<dt>CPF/CNPJ</dt>
					<dd>{nota.cpfcnpj}</dd>
				</div>
				<div>
					<dt>Chave</dt>
					<dd className="mono wrap">{nota.chave || "—"}</dd>
				</div>
				<div>
					<dt>Protocolo</dt>
					<dd className="wrap">{nota.protocolo || "—"}</dd>
				</div>
				<div>
					<dt>Total</dt>
					<dd>
						<Money cents={nota.total} />
					</dd>
				</div>
			</dl>

			{(nota.itens ?? []).length > 0 && (
				<div className="table-wrap">
					<table className="table-sm">
						<thead>
							<tr>
								<th>Item</th>
								<th>Código</th>
								<th>Descrição</th>
								<th>CFOP</th>
								<th>CClass</th>
								<th>Qtd</th>
								<th>Unitário</th>
								<th>Total</th>
								<th>Alíq. ICMS</th>
								<th>ICMS</th>
							</tr>
						</thead>
						<tbody>
							{(nota.itens ?? []).map((i, idx) => (
								<tr key={`${i.item}-${idx}`}>
									<td>{i.item}</td>
									<td>{i.codigo || "—"}</td>
									<td>{i.descricao}</td>
									<td>{i.cfop}</td>
									<td>{i.cclass}</td>
									<td className="num">{formatQtd(i.quantidade)}</td>
									<td className="num">
										<Money cents={i.unitario} />
									</td>
									<td className="num">
										<Money cents={i.total} />
									</td>
									<td className="num">{formatAliq(i.aliqIcms)}</td>
									<td className="num">
										<Money cents={i.icms} />
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</article>
	);
}

function SecaoEmissao({ emissao }: { emissao: EmissaoView }) {
	return (
		<section className="card">
			<div className="card-header">
				<h3>Status da emissão</h3>
				<StatusBadge escopo="fatura" value={emissao.status} />
			</div>

			<div className="table-wrap">
				<table className="table-sm">
					<thead>
						<tr>
							<th>Cobrança</th>
							<th>Status</th>
							<th>Nota</th>
							<th>Situação SEFAZ</th>
							<th>Chave</th>
							<th>Protocolo</th>
						</tr>
					</thead>
					<tbody>
						{(emissao.cobrancas ?? []).flatMap((c) =>
							(c.notas ?? []).length === 0
								? [
										<tr key={`c${c.id}`}>
											<td>{c.id}</td>
											<td>
												<StatusBadge escopo="cobranca" value={c.status} />
											</td>
											<td className="muted" colSpan={4}>
												Sem notas
											</td>
										</tr>,
									]
								: (c.notas ?? []).map((n) => (
										<tr key={`c${c.id}-n${n.id}`}>
											<td>{c.id}</td>
											<td>
												<StatusBadge escopo="cobranca" value={c.status} />
											</td>
											<td>{n.id}</td>
											<td>
												<StatusBadge escopo="situacao" value={n.situacao} />
											</td>
											<td className="mono wrap">{n.chave || "—"}</td>
											<td className="mono wrap">{n.protocolo || "—"}</td>
										</tr>
									)),
						)}
					</tbody>
				</table>
			</div>

			{(emissao.erros ?? []).length > 0 ? (
				<>
					<h4>Erros</h4>
					<div className="table-wrap">
						<table>
							<thead>
								<tr>
									<th>Erro</th>
									<th>Cobrança</th>
									<th>Nota</th>
									<th>Status HTTP</th>
									<th>Mensagem</th>
								</tr>
							</thead>
							<tbody>
								{(emissao.erros ?? []).map((e) => (
									<tr key={e.id}>
										<td>{e.erro}</td>
										<td>{e.cobrancaId}</td>
										<td>{e.notaId}</td>
										<td className="num">{e.statusCode}</td>
										<td>{e.mensagem}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</>
			) : (
				<p className="muted">Nenhum erro registrado.</p>
			)}
		</section>
	);
}
