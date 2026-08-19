/**
 * Worker de emissão (SPEC-0001, ADR-0002, ADR-0003).
 *
 * Árvore BullMQ Flows: `emit-fatura → emit-cobranca → emit-nfcom`.
 * - `emit-fatura` (parent): lease da fatura, marca `emitindo` via outbox,
 *   fan-out de `emit-cobranca` por cobrança; callback consolida `emitida/parcial/erro`.
 * - `emit-cobranca` (child): idempotência `cobranca:{id}:boleto` (consult-before-re-emit,
 *   caso 5), customer buscar/atualizar (caso 16), boleto; fan-out de `emit-nfcom`
 *   por nota — **mesmo se o boleto falhar** (caso 18: nota independe do boleto).
 *   Tem 2 passadas (M1): (1) boleto + fan-out das notas; (2) quando as notas
 *   (children) completam, coleta os `ResultadoEmitNfcom` via `getChildrenValues`
 *   e devolve o `ResultadoEmitCobranca` final com `notasOk[]` REAIS — permitindo
 *   ao parent consolidar a fatura pela nota, não pelo boolean do boleto
 *   (conserta casos 7/10/11/18).
 * - `emit-nfcom` (child): idempotência `nfcom:{id}:emitir` (caso 15: não re-emite em
 *   retry pós-crash → erro+inspeção), mapeamento situacao (casos 6/7), reauth 401
 *   transparente (caso 9, no módulo NFCom). "processando" (caso 6) exausto → a nota
 *   vai a `erro` via outbox (caso 17 / M2).
 *
 * Webhook (C3): cada mudança de estado relevante (fatura emitindo/emitida/parcial/
 * erro, cobranca emitida, nfcom emitida/erro) enfileira `EventoWebhook` via
 * `QueuePort.enfileirarWebhook` — no-op quando WEBHOOK_URL vazia (caso 14).
 *
 * Handlers são funções puras `(job, deps)` para testar SEM Redis — o wiring BullMQ
 * (Worker/Flow/addChild) é uma camada fina em `criarEmissaoWorker`.
 */
import {
	acquireKey,
	resolveKey,
	type IdempotencyAcquire,
} from "@emissor/db/idempotency";
import { WaitingChildrenError } from "bullmq";
import { acquireLease, reassumirLeaseSeStale, releaseLease } from "@emissor/db/lease";
import { enqueueOutbox } from "@emissor/db/outbox";
import { mapearSituacaoNota } from "#/domain/emissao/situacao";
import { consolidarFatura, hojeEmSP, resultadosDaFatura, type ResultadoCobranca } from "#/domain/emissao/consolidacao";
import { mascararDoc } from "#/domain/fatura/cpf-cnpj";
import { runWithLogContext, log } from "#/lib/logger";
import type { AtacadoPort } from "#/domain/ports/atacado.port";
import type { AsaasPort } from "#/domain/ports/asaas.port";
import type { NfcomPort } from "#/domain/ports/nfcom.port";
import type { QueuePort } from "#/domain/ports/queue.port";
import { calcularEventoId } from "#/workers/webhook.worker";
import type {
	Cobranca,
	EventoWebhook,
	Fatura,
	Item,
	Nota,
	StatusCobranca,
	StatusFatura,
	StatusInternoNota,
	SituacaoNota,
} from "#/domain/types";

/** Erro que sinaliza retry ao BullMQ (backoff) — distinto de fatal. */
export class ErroRetryable extends Error {
	constructor(msg: string, public causa?: unknown) {
		super(msg);
	}
}

/** Erro fatal: não retryar (ex.: nota rejeitada/cancelada — caso 7). */
export class ErroFatal extends Error {
	constructor(msg: string, public causa?: unknown) {
		super(msg);
	}
}

/** Nº default de tentativas (espelha WORKER_DEFAULTS.attempts, sem importar env). */
const ATTEMPTS_DEFAULT = 5;

/** Job data do parent `emit-fatura`. */
export interface EmitFaturaData {
	faturaId: number;
	/** Opcional por compat (C2): o caminho de produção carrega a fatura por id (`getFaturaPorId`). */
	parceiroId?: number;
	dataReferencia?: string;
}

/** Job data do child `emit-cobranca`. */
export interface EmitCobrancaData {
	cobrancaId: number;
	faturaId: number;
	valorTotal: number;
	documentoDevedor: string;
	nomeDevedor: string;
	emailDevedor: string;
	dataVencimento: string;
	notas: ResumoNota[];
}

/** Resumo da nota suficiente p/ enfileirar `emit-nfcom` (sem itens pesados no job). */
export interface ResumoNota {
	notaId: number;
	cpfcnpj: string;
	nome: string;
	email?: string;
	rgie?: string;
	telefone?: string;
	uf: string;
	cidade: string;
	// endereco + itens carregados via carregarNota, ou embutidos
	logradouro: string;
	numero: string;
	bairro: string;
	cep: string;
	total: number;
	itens: Item[];
}

/** Job data do child `emit-nfcom`. */
export interface EmitNfcomData {
	notaId: number;
	cobrancaId: number;
	faturaId: number;
	destinatario: {
		nome: string;
		cpfcnpj: string;
		email?: string;
		rgie?: string;
		telefone?: string;
		uf: string;
		cidade: string;
		logradouro: string;
		numero: string;
		bairro: string;
		cep: string;
	};
	itens: Item[];
	total: number;
}

/**
 * Shape mínimo dos dependencies de um job no Flow (shape do
 * `job.getDependencies()` do BullMQ 6.x, sem os cursors de paginação).
 * - `processed`: child key → `returnvalue` (SÓ children COMPLETADOS — o hash
 *   é gravado pelo `moveToFinished` no caminho de sucesso);
 * - `unprocessed`: children ainda pendentes (não terminaram);
 * - `failed`: ids dos children que terminaram em falha (exaustos).
 *
 * Nota (A1): um child que falha/exaure NÃO produz `returnvalue` (o
 * `moveToFinished` failed só registra nos sets `:unsuccessful`/`:failed`),
 * então "values ausentes + `unprocessed` vazio + `failed` não vazio" = todos
 * os children terminaram com falha → consolidação pelo estado real (A2).
 */
export interface DependenciesLike {
	processed?: Record<string, unknown>;
	unprocessed?: string[];
	failed?: string[];
	ignored?: Record<string, unknown>;
}

/** Job-like object mínimo (compatível c/ BullMQ Job p/ testes). */
export interface JobLike<T = unknown> {
	data: T;
	attemptsMade: number;
	opts: { attempts?: number };
	id?: string;
	/**
	 * Dependências do job na árvore do Flow (`job.getDependencies()` do BullMQ —
	 * o real job tem o método; o stub de teste implementa opcionalmente). Base da
	 * decisão 1ª vs 2ª passada (A1): na 1ª passada legítima ainda não há children
	 * registrados (shape vazio); após o fan-out, o parent reentra SEMPRE com
	 * children visíveis. A visibilidade dos `childrenValues` é secundária.
	 */
	getDependencies?: () => Promise<DependenciesLike>;
	/**
	 * Move o job p/ `waiting-children` (BullMQ). `true` = havia children
	 * pendentes e o job foi estacionado (chamar lança `WaitingChildrenError`
	 * p/ o worker não contar como falha); `false` = todos os children já
	 * terminaram (consolida). Token do lock do worker (2º arg do processor).
	 */
	moveToWaitingChildren?: (token: string) => Promise<boolean>;
}

/**
 * Dependências injetadas nos handlers (testes passam fakes; o composition root
 * passa os reais). `enqueueFilho` abstrai o fan-out do Flow (testável sem Redis).
 *
 * `db` é tipado como o DB de coordenação (`CoordDB`); os helpers de `@emissor/db/*`
 * tipam o seu parâmetro como `LibSQLDatabase<Record<string, never>>` —
 * incompatível com `CoordDB` por invariância de schema. O cast `as any` no
 * `helperDb` resolve o atrito sem mexer no src/lib (fora de escopo desta fase).
 */
type DbHelper = Parameters<typeof acquireKey>[0];

export interface EmissaoDeps {
	atacado: AtacadoPort;
	asaas: AsaasPort;
	nfcom: NfcomPort;
	db: import("@emissor/db/client").CoordDB;
	/** Enfileira um job filho (fan-out). Testes stubbam; o wiring BullMQ implementa. */
	enqueueFilho?: (name: string, data: unknown) => Promise<void>;
	/** Carrega a fatura com árvore (cobranças + notas). Default via atacado.getFaturaPorId (C2). */
	carregarFatura?: (faturaId: number, parceiroId: number, dataReferencia: string) => Promise<Fatura | null>;
	/**
	 * QueuePort p/ enfileirar eventos de webhook (C3) a cada mudança de estado.
	 * No-op quando ausente (testes sem webhook) ou quando WEBHOOK_URL vazia.
	 */
	queue?: QueuePort;
	/**
	 * Limiar de staleness do lease (ms). Se o lease está sendo há mais que isso,
	 * assume-se morto (BullMQ stalled/failed) e reassume (SPEC-0001 caso 2).
	 * Default 3 min. O composition root injeta conforme stalledInterval/maxStalledCount.
	 */
	limiteLeaseStaleMs?: number;
}

/** Passa o DB de coordenação aos helpers de lib/db (tipos reconciliados — CoordDB). */
function helperDb(db: EmissaoDeps["db"]) {
	return db;
}

/** É a última tentativa do job (M2: exaurido → não retryar, marcar erro). */
function ehUltimaTentativa(job: JobLike): boolean {
	const attempts = job.opts.attempts ?? ATTEMPTS_DEFAULT;
	return job.attemptsMade + 1 >= attempts;
}

/**
 * Enfileira um evento de webhook (C3). `eventoId` determinístico por
 * `(faturaId, alvo, estado, timestamp)`. No-op quando `deps.queue` ausente.
 */
async function enfileirarEventoWebhook(
	deps: EmissaoDeps,
	args: {
		faturaId: number;
		tipo: EventoWebhook["tipo"];
		alvo: EventoWebhook["alvo"];
		estado: string;
		erros?: EventoWebhook["erros"];
	},
): Promise<void> {
	if (!deps.queue) return;
	const timestamp = new Date().toISOString();
	const evento: EventoWebhook = {
		eventoId: "",
		faturaId: args.faturaId,
		tipo: args.tipo,
		alvo: args.alvo,
		estado: args.estado,
		erros: args.erros,
		timestamp,
	};
	evento.eventoId = calcularEventoId(evento);
	await deps.queue.enfileirarWebhook(evento);
}

/** Marca a nota `erro` via outbox + registra o erro (usado nos caminhos de falha). */
async function marcarNotaErroEOutbox(
	db: EmissaoDeps["db"],
	notaId: number,
	erro: string,
	mensagem: string,
): Promise<void> {
	await enqueueOutbox(db, {
		aggregate: "nota",
		aggregateId: notaId,
		payload: { op: "atualizarStatusNota", id: notaId, statusInterno: "erro" },
	});
	await enqueueOutbox(db, {
		aggregate: "erro",
		aggregateId: notaId,
		payload: { op: "registrarErro", notaId, erro, mensagem },
	});
}

/**
 * Detecta a rejeição `Duplicidade de NFCom [nProt:...]` do gateway (HTTP 500 +
 * body `status: Erro`), que o client traduz em `NfcomApiError` cuja mensagem
 * contém o texto. É o sinal de que a nota JÁ foi autorizada por uma emissão
 * anterior (issue #4, Falha B) — deve reconciliar para `emitida`, não `erro`.
 */
function ehDuplicidadeNFCom(err: unknown): boolean {
	const msg = err instanceof Error ? err.message : String(err);
	return /duplicidade de nfcom/i.test(msg);
}

/**
 * Extrai o número da nota (nNF) da chave de acesso de 44 dígitos (spec NFe:
 * os dígitos 26-34, 9 posições). Fallback para o caminho de reconciliação de
 * duplicidade — onde o gateway `/api/lista` devolve só chave/protocolo (sem
 * número) — e como salvaguarda no caminho feliz se `res.numero` vier vazio.
 * Chave ausente/malformada → `undefined` (não assume valor).
 */
export function numeroDaChave(chave: string | undefined): number | undefined {
	if (!chave || chave.length < 44) return undefined;
	const n = Number(chave.substring(25, 34));
	return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * Janela de datas para a inspeção em `/api/lista` (ISO UTC, `YYYY-MM-DD`).
 * SEFAZ pode ter latência curta entre autorizar e indexar na lista — usa hoje
 * ±1 dia. Derivado de `hojeEmSP()` (fuso do domínio America/Sao_Paulo, M9) —
 * o `new Date()` fica dentro da função (chamada), não em nível de módulo,
 * seguindo a convenção de timestamps do arquivo.
 */
function janelaInspecao(): { inicio: string; fim: string } {
	const hoje = hojeEmSP();
	const ano = Number(hoje.slice(0, 4));
	const mes = Number(hoje.slice(5, 7));
	const dia = Number(hoje.slice(8, 10));
	const hojeNum = new Date(Date.UTC(ano, mes - 1, dia));
	const inicio = new Date(hojeNum.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
	const fim = new Date(hojeNum.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
	return { inicio, fim };
}

/**
 * Busca no `/api/lista` a nota AUTORIZADA do mesmo destinatário na janela curta
 * de inspeção (hoje ±1 dia). `/api/lista` exige `cpfcnpj` MASCARADO — verificado
 * no swagger (`GET api/lista?cpfcnpj=07.994.598/0001-20`): o gateway Vigo roteia
 * CPF/CNPJ pela formatação (issue #2), e o `consultaLista` do client passa o
 * parâmetro sem mascarar. O domínio carrega o documento limpo; a máscara é
 * aplicada só nesta fronteira, como já faz o `montarPayloadEmitir` no `/api/emitir`.
 */
async function buscarNotaAutorizada(
	deps: EmissaoDeps,
	d: EmitNfcomData,
): Promise<{ chave: string; protocolo: string } | null> {
	const { inicio, fim } = janelaInspecao();
	const itens = await deps.nfcom.consultarLista(mascararDoc(d.destinatario.cpfcnpj), inicio, fim);
	const aut = itens.find((i) => i.situacao === "autorizada");
	return aut ? { chave: aut.chave, protocolo: aut.protocolo } : null;
}

// ============================================================
// Handler: emit-fatura (parent)
// ============================================================

export interface ResultadoEmitFatura {
	status: StatusFatura;
}

/**
 * Parent: adquire lease, marca `emitindo`, fan-out cobranças. O callback de
 * consolidação roda quando toda a árvore resolve (segunda passada no wiring).
 *
 * Caso M3/A3: se 0 cobranças a-emitir (todas já emitidas, em erro, ou
 * assassinadas), não há children → não há segunda passada → o lease ficaria
 * preso. Consolida pelo ESTADO REAL das cobranças (`consolidar(resultadosDaFatura)`
 * — `emitida`/`parcial`/`erro`, não hardcoded) e libera o lease aqui.
 *
 * `ErroFatal` (fatura não encontrada) libera o lease via catch (m1) — ainda não há
 * children para drenar a consolidação.
 *
 * C2: o carregador default usa `atacado.getFaturaPorId(faturaId)` (canônico) em vez
 * de `buscarFaturaPorChave(parceiroId, dataReferencia)` — o job enfileirado só
 * precisa carregar `{faturaId}`.
 */
export async function handleEmitFatura(
	job: JobLike<EmitFaturaData>,
	deps: EmissaoDeps,
): Promise<{ enfileiradas: number }> {
	const { faturaId } = job.data;
	return runWithLogContext({ faturaId, jobId: job.id, fila: "emissao" }, async () => {
		const db = helperDb(deps.db);
		let acquired = await acquireLease(db, faturaId);
		if (!acquired) {
			// SPEC-0001 caso 2: lease já existe — pode ser de um job morto (stalled/
			// failed sem release). Tenta reassumir se stale (limiar de tempo).
			const limite = deps.limiteLeaseStaleMs ?? 3 * 60 * 1000;
			const reassumido = await reassumirLeaseSeStale(db, faturaId, limite);
			if (!reassumido) {
				// A4 (defesa em profundidade): em RE-ENTRADA (attemptsMade > 0) o "pular"
				// silencioso era o Defeito A — o job resolvia com children pendentes, o
				// `moveToFinished` lançava JobPendingChildren e queimava a tentativa.
				// Com A1 bem feito este caminho raramente aciona; quando aciona em
				// re-entrada, o certo é RE-ATIVAR (backoff) até o lease virar stale.
				if (job.attemptsMade > 0) {
					throw new ErroRetryable("lease de outrem em re-entrada — aguardando (stale)");
				}
				log.warn({ faturaId }, "fatura com lease ativo — outro job detém; pulando");
				return { enfileiradas: 0 };
			}
			acquired = true;
			log.warn({ faturaId }, "lease stale reassumido (job anterior presumido morto)");
		}
		try {
			// C2: default carrega por id (canônico). `parceiroId`/`dataReferencia` ficam
			// órfãos no job, mas o default não depende deles.
			const carregar = deps.carregarFatura ?? ((id: number) => deps.atacado.getFaturaPorId(id));
			const fatura = await carregar(faturaId, job.data.parceiroId ?? 0, job.data.dataReferencia ?? "");
			if (!fatura) {
				// m1: ErroFatal na 1ª passada — nenhum child para drenar a consolidação.
				throw new ErroFatal(`fatura ${faturaId} não encontrada`);
			}
			// marca emitindo via outbox + webhook
			await enqueueOutbox(db, {
				aggregate: "fatura",
				aggregateId: faturaId,
				payload: { op: "atualizarStatusFatura", id: faturaId, status: "emitindo" },
			});
			await enfileirarEventoWebhook(deps, {
				faturaId,
				tipo: "fatura.status",
				alvo: { faturaId },
				estado: "emitindo",
			});
			// fan-out cobranças a-emitir
			const cobrancasAEmitir = fatura.cobrancas.filter((c) => c.status === "a-emitir");
			if (cobrancasAEmitir.length === 0) {
				// M3 (A3): sem cobranças a-emitir → sem children → não haverá 2ª passada
				// para consolidar. Deriva o status FINAL dos status REAIS das cobranças
				// (não hardcode `emitida` — uma cobrança em `erro` também não é a-emitir)
				// e libera o lease aqui. É também a porta do self-healing na re-emissão
				// de uma fatura já processada.
				const status = consolidar(resultadosDaFatura(fatura));
				log.info({ faturaId, status }, "0 cobranças a-emitir — consolidando pelo estado real (M3/A3)");
				await consolidarFaturaEliberar(db, deps, faturaId, status);
				return { enfileiradas: 0 };
			}
			const enqueue = deps.enqueueFilho ?? (async () => {});
			for (const c of cobrancasAEmitir) {
				await enqueue("emit-cobranca", toCobrancaData(c));
			}
			return { enfileiradas: cobrancasAEmitir.length };
		} catch (err) {
			// m1: ErroFatal na 1ª passada → libera o lease (sem children para drenar).
			if (err instanceof ErroFatal) {
				await releaseLease(db, faturaId);
			}
			throw err;
		}
	});
}

function toCobrancaData(c: Cobranca): EmitCobrancaData {
	return {
		cobrancaId: c.id!,
		faturaId: c.faturaId,
		valorTotal: c.valorTotal,
		documentoDevedor: c.documentoDevedor,
		nomeDevedor: c.nomeDevedor,
		emailDevedor: c.emailDevedor,
		dataVencimento: c.dataVencimento,
		notas: c.notas.filter((n) => n.statusInterno === "a-emitir").map(toResumoNota),
	};
}

function toResumoNota(n: Nota): ResumoNota {
	return {
		notaId: n.id!,
		cpfcnpj: n.cpfcnpj,
		nome: n.nome,
		email: n.email,
		rgie: n.rgie,
		telefone: n.telefone,
		uf: n.uf,
		cidade: n.cidade,
		logradouro: n.endereco.logradouro,
		numero: n.endereco.numero,
		bairro: n.endereco.bairro,
		cep: n.endereco.cep,
		total: n.total,
		itens: n.itens,
	};
}

// ============================================================
// Handler: emit-cobranca (child) — 1ª passada (boleto + fan-out notas)
// ============================================================

export interface ResultadoEmitCobranca {
	boletoOk: boolean;
	/** Resultados REAIS das notas (emit-nfcom children) — coletados na 2ª passada (M1). */
	notasOk: boolean[];
	erro?: string;
}

/**
 * Primeira passada do `emit-cobranca`: idempotência do boleto (caso 5), customer
 * buscar/atualizar (caso 16), e fan-out de `emit-nfcom` por nota — **mesmo se o
 * boleto falhar** (caso 18). Retorna quantas notas enfileirou; o resultado final
 * (`notasOk[]`) é derivado na segunda passada (`consolidarCobranca`) quando as
 * notas (children) completam.
 */
export async function handleEmitCobranca(
	job: JobLike<EmitCobrancaData>,
	deps: EmissaoDeps,
): Promise<{ boletoOk: boolean; notasEnfileiradas: number; erro?: string }> {
	const d = job.data;
	const db = helperDb(deps.db);
	const { asaas } = deps;
	return runWithLogContext({ jobId: job.id, fila: "emissao" }, async () => {
		const key = `cobranca:${d.cobrancaId}:boleto`;
		let boletoOk = false;
		let erroMsg: string | undefined;
		try {
			const acquired = await acquireKey(db, key, "asaas");
			if (acquired.status === "resolved") {
				// key resolvida → reutiliza idExterno. A key só guarda externalId (não o
				// linkFatura), então re-busca o link no Asaas para não perdê-lo (m3).
				const ref = `cobranca:${d.cobrancaId}`;
				const existente = await asaas.consultarBoletoPorExternalReference(ref);
				const linkFatura = existente?.linkFatura ?? "";
				await commitCobranca(deps, db, d, acquired.externalId, linkFatura);
				boletoOk = true;
			} else {
				// in_progress: pode ser 1ª tentativa OU retry pós-crash (caso 5)
				const existing = await asaas.consultarBoletoPorExternalReference(`cobranca:${d.cobrancaId}`);
				if (existing) {
					// boleto já existe no Asaas (criado antes do crash) → resolve, não duplica
					await resolveKey(db, key, existing.idExterno);
					await commitCobranca(deps, db, d, existing.idExterno, existing.linkFatura);
					boletoOk = true;
				} else {
					// não existe → cria customer + boleto
					const customer = await ensureCustomer(asaas, d.documentoDevedor, d.nomeDevedor, d.emailDevedor);
					const boleto = await asaas.criarBoleto({
						customerId: customer.id,
						valor: d.valorTotal,
						vencimento: d.dataVencimento,
						externalReference: `cobranca:${d.cobrancaId}`,
					});
					await resolveKey(db, key, boleto.idExterno);
					await commitCobranca(deps, db, d, boleto.idExterno, boleto.linkFatura);
					boletoOk = true;
				}
			}
		} catch (err) {
			erroMsg = err instanceof Error ? err.message : String(err);
			// boleto falhou → cobrança vai a erro, MAS notas ainda emitem (caso 18)
			await enqueueOutbox(db, {
				aggregate: "cobranca",
				aggregateId: d.cobrancaId,
				payload: { op: "atualizarStatusCobranca", id: d.cobrancaId, status: "erro" },
			});
			await enqueueOutbox(db, {
				aggregate: "erro",
				aggregateId: d.cobrancaId,
				payload: { op: "registrarErro", cobrancaId: d.cobrancaId, erro: "BOLETO", mensagem: erroMsg },
			});
			log.error({ err, cobrancaId: d.cobrancaId }, "boleto falhou — notas seguem (caso 18)");
		}
		// fan-out notas INDEPENDENTE do boleto (caso 18)
		const enqueue = deps.enqueueFilho ?? (async () => {});
		let notasEnfileiradas = 0;
		for (const n of d.notas) {
			await enqueue("emit-nfcom", toNfcomData(n, d.cobrancaId, d.faturaId));
			notasEnfileiradas++;
		}
		return { boletoOk, notasEnfileiradas, erro: erroMsg };
	});
}

/**
 * Segunda passada do `emit-cobranca` (M1): quando os `emit-nfcom` (children)
 * completam, o BullMQ reativa o job e expõe os resultados via `getChildrenValues`.
 * Coleta os `ResultadoEmitNfcom` reais → `notasOk[]` no `ResultadoEmitCobranca`
 * final. O parent (`emit-fatura`) então consolida pela nota verdadeira, não por um
 * boolean aproximado do boleto.
 *
 * Decisão (documentada — M1): em vez de uma tabela leve de resultados no SQLite,
 * prefere-se a coleta via Flow `getChildrenValues`, mantendo a árvore BullMQ
 * autocontida (ADR-0002) e sem escrita extra no banco de coordenação. O `boletoOk`
 * aqui é re-derivado da key `cobranca:{id}:boleto` (resolved ⇒ boleto emitido) —
 * o resultado do boleto foi persistido na 1ª passada.
 */
export async function consolidarCobranca(
	job: JobLike<EmitCobrancaData>,
	childrenValues: Record<string, ResultadoEmitNfcom>,
	deps: EmissaoDeps,
): Promise<ResultadoEmitCobranca> {
	const d = job.data;
	const db = helperDb(deps.db);
	const key = `cobranca:${d.cobrancaId}:boleto`;
	const boleto = await acquireKey(db, key, "asaas");
	const boletoOk = boleto.status === "resolved";
	const notasOk = Object.values(childrenValues).map((r) => r.notaOk);
	log.info(
		{ cobrancaId: d.cobrancaId, boletoOk, notasOk: notasOk.length },
		"cobranca consolidada (2ª passada) — notasOk reais do grandchildren",
	);
	return { boletoOk, notasOk, erro: boletoOk ? undefined : "boleto não emitido" };
}

async function ensureCustomer(
	asaas: AsaasPort,
	doc: string,
	nome: string,
	email: string,
) {
	const existing = await asaas.buscarCustomerPorDocumento(doc);
	if (existing) {
		// caso 16: dados divergentes do CRM → atualiza (Atacado é fonte de domínio)
		await asaas.atualizarCustomer(existing.id, { name: nome, email });
		return existing;
	}
	return asaas.criarCustomer({ name: nome, email, cpfCnpj: doc });
}

/**
 * Marca a cobrança `emitida` via outbox (dataEmissao em America/Sao_Paulo — M9)
 * e enfileira o webhook `cobranca.status=emitida` (C3).
 */
async function commitCobranca(
	deps: EmissaoDeps,
	db: import("@emissor/db/client").CoordDB,
	d: EmitCobrancaData,
	idExterno: string,
	linkFatura: string,
) {
	await enqueueOutbox(db, {
		aggregate: "cobranca",
		aggregateId: d.cobrancaId,
		payload: {
			op: "atualizarStatusCobranca",
			id: d.cobrancaId,
			status: "emitida",
			extra: { idExterno, linkFatura, dataEmissao: hojeEmSP() },
		},
	});
	await enfileirarEventoWebhook(deps, {
		faturaId: d.faturaId,
		tipo: "cobranca.status",
		alvo: { cobrancaId: d.cobrancaId },
		estado: "emitida",
	});
}

function toNfcomData(n: ResumoNota, cobrancaId: number, faturaId: number): EmitNfcomData {
	return {
		notaId: n.notaId,
		cobrancaId,
		faturaId,
		destinatario: {
			nome: n.nome,
			cpfcnpj: n.cpfcnpj,
			email: n.email,
			rgie: n.rgie,
			telefone: n.telefone,
			uf: n.uf,
			cidade: n.cidade,
			logradouro: n.logradouro,
			numero: n.numero,
			bairro: n.bairro,
			cep: n.cep,
		},
		itens: n.itens,
		total: n.total,
	};
}

// ============================================================
// Handler: emit-nfcom (child)
// ============================================================

export interface ResultadoEmitNfcom {
	notaOk: boolean;
	statusInterno: StatusInternoNota;
	erro?: string;
}

export async function handleEmitNfcom(
	job: JobLike<EmitNfcomData>,
	deps: EmissaoDeps,
): Promise<ResultadoEmitNfcom> {
	const d = job.data;
	const db = helperDb(deps.db);
	const { nfcom } = deps;
	return runWithLogContext({ jobId: job.id, fila: "emissao" }, async () => {
		const webhookNota = async (estado: string, erros?: EventoWebhook["erros"]) =>
			enfileirarEventoWebhook(deps, {
				faturaId: d.faturaId,
				tipo: "nfcom.situacao",
				alvo: { cobrancaId: d.cobrancaId, notaId: d.notaId },
				estado,
				erros,
			});
		const key = `nfcom:${d.notaId}:emitir`;
		const acquired = await acquireKey(db, key, "nfcom");
		if (acquired.status === "resolved") {
			// sentinel "processando": o gateway ack o POST e está processando (caso 6).
			// Não é um crash (caso 15) — o POST sucedeu. Continua retrying até o gateway
			// devolver situação final; na última tentativa, marca `erro` (caso 17 / M2).
			if (acquired.externalId === "processando") {
				if (ehUltimaTentativa(job)) {
					// M2: exauriu as tentativas com o gateway ainda processando → erro via outbox.
					const msg = `nota ${d.notaId} ainda processando no gateway após esgotar tentativas`;
					await marcarNotaErroEOutbox(db, d.notaId, "NFCOM_PROCESSANDO", msg);
					await webhookNota("erro", [{ cobrancaId: d.cobrancaId, tipo: "FATAL", mensagem: msg }]);
					log.error({ notaId: d.notaId }, msg);
					return { notaOk: false, statusInterno: "erro", erro: msg };
				}
				throw new ErroRetryable(`nota ${d.notaId} ainda processando no gateway`);
			}
			// nota já emitida → reutiliza chave/protocolo
			await enqueueOutbox(db, {
				aggregate: "nota",
				aggregateId: d.notaId,
				payload: { op: "atualizarStatusNota", id: d.notaId, statusInterno: "emitida" },
			});
			await webhookNota("emitida");
			return { notaOk: true, statusInterno: "emitida" };
		}
		// in_progress e ESTE job NÃO é o dono da key (acquired=false) → outro job
		// (ou um retry/crash do dono original) está/esteve emitindo. NÃO re-emite
		// (zero auto-duplicação) → inspeção (caso 15). O guard se baseia na POSSE da
		// key (acquired.acquired), não no histórico do job (attemptsMade): cobre tanto
		// o retry do mesmo job pós-crash (dono stallou entre POST e resolveKey) quanto
		// um 2º job distinto (attemptsMade===0, mas acquired=false — outro é o dono).
		// Issue #4: antes, um 2º job com attemptsMade===0 passava direto e re-emitia
		// uma nota já autorizada (o gateway respondia Duplicidade de NFCom → a nota
		// ia a erro mesmo estando autorizada). Hoje o guard é robusto a qualquer job
		// que não detém a key.
		if (acquired.status === "in_progress" && !acquired.acquired) {
			const msg = "suspeita de emissão (crash pós-POST) — inspeção manual via /api/lista";
			await marcarNotaErroEOutbox(db, d.notaId, "NFCOM_DEDUP", msg);
			await webhookNota("erro", [{ cobrancaId: d.cobrancaId, tipo: "FATAL", mensagem: msg }]);
			log.warn({ notaId: d.notaId }, "nota marcada como erro p/ inspeção (caso 15)");
			return { notaOk: false, statusInterno: "erro", erro: msg };
		}
		// 1ª tentativa: emite
		try {
			const res = await nfcom.emitirNFCom({
				destinatario: {
					nome: d.destinatario.nome,
					cpfcnpj: d.destinatario.cpfcnpj,
					email: d.destinatario.email,
					rgie: d.destinatario.rgie,
					telefone: d.destinatario.telefone,
					uf: d.destinatario.uf,
					cidade: d.destinatario.cidade,
					endereco: {
						logradouro: d.destinatario.logradouro,
						numero: d.destinatario.numero,
						bairro: d.destinatario.bairro,
						cep: d.destinatario.cep,
						cidade: d.destinatario.cidade,
						uf: d.destinatario.uf,
					},
				},
				itens: d.itens,
			});
			const map = mapearSituacaoNota(res.situacao);
			if (map.statusInterno === "a-emitir") {
				// processando (caso 6) → o POST sucedeu (gateway ack e está processando).
				// Marca a key com sentinel "processando" (resolved c/ externalId="processando")
				// para que um retry NÃO re-emita (zero duplicação) nem dispare o caso 15
				// (que é para crash sem ack do gateway). Continua retrying até situação final.
				await resolveKey(db, key, "processando");
				if (ehUltimaTentativa(job)) {
					// M2: exauriu com o gateway processando mesmo após o emitir → erro via outbox.
					const msg = `nota ${d.notaId} processando no gateway após esgotar tentativas`;
					await marcarNotaErroEOutbox(db, d.notaId, "NFCOM_PROCESSANDO", msg);
					await webhookNota("erro", [{ cobrancaId: d.cobrancaId, tipo: "FATAL", mensagem: msg }]);
					log.error({ notaId: d.notaId }, msg);
					return { notaOk: false, statusInterno: "erro", erro: msg };
				}
				throw new ErroRetryable(`nota ${d.notaId} processando no gateway`);
			}
			// resolve a key SÓ se a chave SEFAZ veio (situações não-autorizadas como
			// `rejeitada` podem não retornar chave — fields [opt] no swagger). Sem chave,
			// não há o que deduplicar por externalId; a proteção anti-duplicação segue no
			// sentinel em `idempotency_keys` (caso 15) e no retry controlado do BullMQ.
			if (res.chave) await resolveKey(db, key, res.chave);
			await enqueueOutbox(db, {
				aggregate: "nota",
				aggregateId: d.notaId,
				payload: {
					op: "atualizarStatusNota",
					id: d.notaId,
					statusInterno: map.statusInterno,
					situacao: map.situacao,
					// Fallback defensivo: se o gateway não devolveu número, deriva
					// da chave (dígitos 26-34) em vez de deixar `f_numero` vazio.
					numero: res.numero ?? numeroDaChave(res.chave),
					serie: res.serie,
					chave: res.chave,
					protocolo: res.protocolo,
					ambiente: res.ambiente,
					pdfUrl: res.pdfUrl,
					xmlUrl: res.xmlUrl,
					pixUrl: res.pixUrl,
				},
			});
			const ok = map.statusInterno === "emitida";
			await webhookNota(ok ? "emitida" : (map.situacao ?? "erro"));
			return { notaOk: ok, statusInterno: map.statusInterno };
		} catch (err) {
			if (err instanceof ErroRetryable) {
				// processando → deixa o BullMQ retryar (não marca erro)
				throw err;
			}
			const msg = err instanceof Error ? err.message : String(err);
			// Duplicidade de NFCom: a nota JÁ foi autorizada por um job anterior (cuja
			// key se perdeu — ex.: banco de coordenação resetado entre POST e resolveKey).
			// O gateway devolve o nProt da nota existente. Reconcilia via /api/lista
			// (cpfcnpj+janela) → marca emitida com a chave/protocolo reais, em vez de
			// erro (Falha B — issue #4).
			if (ehDuplicidadeNFCom(err)) {
				// A inspeção (`/api/lista`) pode falhar (rede/timeout/401 — `consultarLista`
				// NÃO tem retry de reauth como `emitirComRetry`, ADR-0001). NÃO deixamos o
				// erro escapar do catch (deixaria a nota em `a-emitir` sem outbox e falharia
				// o job exausto no BullMQ): falha de inspeção → caminho conservador (erro +
				// inspeção), igual a "não achou a nota na lista". (robustez do Fix 2)
				let encontrada: { chave: string; protocolo: string } | null = null;
				try {
					encontrada = await buscarNotaAutorizada(deps, d);
				} catch (inspErr) {
					log.warn(
						{ err: inspErr, notaId: d.notaId },
						"inspeção /api/lista falhou na reconciliação de duplicidade — caminho conservador",
					);
				}
				if (encontrada) {
					await resolveKey(db, key, encontrada.chave);
					await enqueueOutbox(db, {
						aggregate: "nota",
						aggregateId: d.notaId,
						payload: {
							op: "atualizarStatusNota",
							id: d.notaId,
							statusInterno: "emitida",
							situacao: "autorizada",
							chave: encontrada.chave,
							protocolo: encontrada.protocolo,
						// O `/api/lista` não devolve número/série — deriva o
						// nNF da chave (dígitos 26-34) p/ não deixar `f_numero`
						// vazio na reconciliação de duplicidade.
						numero: numeroDaChave(encontrada.chave),
						},
					});
					await webhookNota("emitida");
					log.warn({ notaId: d.notaId }, "duplicidade NFCom reconciliada p/ emitida (nota já autorizada)");
					return { notaOk: true, statusInterno: "emitida" };
				}
				// não achou na lista → duplicidade sem prova; inspeção (não assume emitida)
				const insp = `Duplicidade de NFCom sem nota localizada na inspeção — ${msg}`;
				await marcarNotaErroEOutbox(db, d.notaId, "NFCOM_DEDUP", insp);
				await webhookNota("erro", [{ cobrancaId: d.cobrancaId, tipo: "FATAL", mensagem: insp }]);
				return { notaOk: false, statusInterno: "erro", erro: insp };
			}
			// erro local (timeout/rede/401 exausto) ou fatal reportado pelo gateway
			await marcarNotaErroEOutbox(db, d.notaId, "NFCOM", msg);
			await webhookNota("erro", [{ cobrancaId: d.cobrancaId, tipo: "FATAL", mensagem: msg }]);
			log.error({ err, notaId: d.notaId }, "emissão de nota falhou");
			return { notaOk: false, statusInterno: "erro", erro: msg };
		}
	});
}

// ============================================================
// Consolidação (callback do parent quando a árvore resolve)
// ============================================================

export function consolidar(resultados: ResultadoCobranca[]): StatusFatura {
	return consolidarFatura(resultados).status;
}

// ============================================================
// Decisão 1ª vs 2ª passada (A1)
// ============================================================

/**
 * Decisão 1ª vs 2ª passada (A1) — pelo nº de children, não só pela
 * visibilidade dos values. O defeito que este substitui: a reentrada do
 * parent quando os `childrenValues` ainda não estavam visíveis caía no
 * fan-out, `acquireLease` falhava (lease da 1ª passada do PRÓPRIO job), o
 * handler "pula" retornando normalmente → BullMQ tenta `moveToFinished`
 * com children pendentes → `JobPendingChildren` queima a tentativa 5x →
 * fatura órfã em `emitindo` + re-fan-out duplicado das notas.
 *
 * - sem children registrados → 1ª passada legítima (fan-out). Na 1ª passada
 *   o parent ainda não tem children (o fan-out os registra); após o fan-out
 *   o BullMQ coloca o parent em `waiting-children` e só o reativa quando
 *   todos terminam — então "com children" implica reentrada.
 * - com children + values visíveis → 2ª passada (consolida — caminho M1).
 * - com children + values ausentes + algum child ainda pendente
 *   (`unprocessed` não vazio) → "aguardar": o dispatch lança `ErroRetryable`
 *   (NUNCA retorna normalmente) — o backoff exponencial dá tempo p/ os
 *   children terminarem e os values persistirem; o BullMQ reativa o job.
 * - com children + values ausentes + todos terminados (failed/exaustos) →
 *   exaustos não produzem `returnvalue` → consolidação pelo ESTADO REAL (A2).
 *
 * Sem `getDependencies` (stub de teste antigo) preserva o comportamento
 * antigo: values visíveis → consolida; senão → fan-out (1ª passada).
 */
export async function decidirPassadaEmissao(
	job: JobLike,
	childrenValues: Record<string, unknown> | undefined,
): Promise<"primeira" | "segunda" | "aguardar" | "exaustas"> {
	const deps = job.getDependencies ? await job.getDependencies() : undefined;
	const temChildren =
		(deps?.processed && Object.keys(deps.processed).length > 0) ||
		(deps?.unprocessed?.length ?? 0) > 0 ||
		(deps?.failed?.length ?? 0) > 0;
	if (!temChildren) return "primeira";
	if (childrenValues && Object.keys(childrenValues).length > 0) return "segunda";
	// values ausentes com children registrados: algum child ainda pendente?
	if ((deps?.unprocessed?.length ?? 0) > 0) return "aguardar";
	// todos terminados sem returnvalue (failed/exaustos) → estado real (A2).
	return "exaustas";
}

// ============================================================
// Dispatch do worker (decisão por jobName — testável SEM Redis)
// ============================================================

/**
 * Vista do job BullMQ usada pelo dispatch (camada fina do wiring + testes):
 * o worker real (`job` do BullMQ) satisfaz este shape por cast; os testes
 * passam stubs.
 */
export interface WorkerCtx {
	jobName: string;
	jobId: string;
	job: JobLike;
	getChildrenValues: <T>() => Promise<Record<string, T> | undefined>;
	/** Fan-out: enfileira um child com ESTE job como parent (per-job). */
	enqueueFilho: (name: string, data: unknown) => Promise<void>;
	/**
	 * Token do lock do worker (2º arg do processor do BullMQ). Necessário p/
	 * `job.moveToWaitingChildren(token)` — estacionar o parent em
	 * `waiting-children` sem custo de attempt enquanto os children rodam.
	 */
	token: string;
}

/**
 * Lê os `returnvalue`s dos children via `ctx.getChildrenValues`, com retry
 * curto. Race BullMQ (C4): o parent é reativado quando os children
 * completam, mas o `returnvalue` final do child pode não estar visível no
 * instante exato do reprocessamento (child faz 2 passadas; o valor final só
 * persiste ao fim). Retry curto (até ~500ms) resolve sem custo perceptível
 * quando os valores já estão disponíveis.
 */
async function getChildrenValuesComRetry<T>(
	ctx: WorkerCtx,
	retries = 10,
	delayMs = 50,
): Promise<Record<string, T> | undefined> {
	for (let i = 0; i < retries; i++) {
		const cv = await ctx.getChildrenValues<T>();
		if (cv && Object.keys(cv).length > 0) return cv;
		await new Promise((r) => setTimeout(r, delayMs));
	}
	return ctx.getChildrenValues<T>();
}

/**
 * Estaciona o parent em `waiting-children` (sem custo de attempt — idiom
 * BullMQ p/ "pai espera children"). Retorna:
 * - `false` se `moveToWaitingChildren` moveu o job (havia children pendentes):
 *   lança `WaitingChildrenError`, que o worker trata como "aguardar" (não
 *   conta como falha); o BullMQ reativa o parent quando os children
 *   terminam. A exceção é lançada aqui p/ o dispatch não retornar normalmente.
 * - `true` se NÃO havia pendentes (todos os children já terminaram, mas os
 *   `childrenValues` ainda não estavam visíveis no retry curto): o caller
 *   consolida pelo estado real (A2).
 *
 * `moveToWaitingChildren` ausente (stub de teste sem Redis) → fallback:
 * lança `WaitingChildrenError` (assume pendente) p/ preservar o comportamento
 * de "não retornar normalmente com children pendentes".
 */
async function estacionarOuPronto(ctx: WorkerCtx): Promise<boolean> {
	// `ctx.job` é o Job real do BullMQ (cast `as unknown as JobLike` preserva o
	// objeto — tem `backend`/`queue`). Chamado como MÉTODO (`ctx.job.moveToWaitingChildren?.(token)`)
	// p/ não perder o `this` (desestruturar em variável desvincula e `this.backend`
	// fica undefined — bug que travava a fatura em `emitindo`).
	if (!ctx.job.moveToWaitingChildren) {
		// Sem BullMQ real (teste): estaciona (assume pendente).
		throw new WaitingChildrenError();
	}
	const shouldWait = await ctx.job.moveToWaitingChildren(ctx.token);
	if (shouldWait) {
		// Havia pendentes — estaciona.
		throw new WaitingChildrenError();
	}
	// Todos terminaram (values ainda não visíveis no retry) — pronto p/ A2.
	return true;
}

/**
 * Dispatch do worker de emissão por `jobName` (o "cérebro" da camada fina do
 * wiring). Puro em Redis: `getChildrenValues`/`enqueueFilho` vêm por `ctx`,
 * então as 4 células do A1 (1ª passada / 2ª passada / aguardar / exaustas)
 * são testáveis com stubs — o wiring em `criarEmissaoWorker` só liga o job
 * real do BullMQ a este dispatch.
 */
export async function processarJobEmissao(ctx: WorkerCtx, deps: EmissaoDeps): Promise<unknown> {
	const { jobName, job } = ctx;
	if (jobName === "emit-fatura") {
		// A1: a decisão 1ª vs 2ª passada é pelo nº de children registrados
		// (`job.getDependencies()`), não só pela visibilidade dos values — a
		// reentrada sem childrenValues visíveis NÃO pode mais cair no fan-out
		// (que "pula" o lease e queima a tentativa via `moveToFinished` com
		// children pendentes — o Defeito A).
		const childrenValues = await getChildrenValuesComRetry<ResultadoEmitCobranca>(ctx);
		const passada = await decidirPassadaEmissao(job, childrenValues);
		if (passada === "aguardar") {
			// Children em andamento: estaciona o parent em `waiting-children`
			// (sem custo de attempt — o BullMQ reativa quando os children
			// terminam). `moveToWaitingChildren` retorna `true` se havia
			// pendentes (lança `WaitingChildrenError`, que o worker trata como
			// "aguardar", NÃO como falha) ou `false` se todos já terminaram (os
			// values ainda não estavam visíveis no retry curto — consolida
			// pelo estado real, A2).
			if (await estacionarOuPronto(ctx)) return consolidarFaturaPorEstado(job as JobLike<EmitFaturaData>, deps);
		}
		if (passada === "segunda") {
			return consolidarFaturaOuCobranca(job as unknown as { data: EmitFaturaData }, childrenValues!, deps);
		}
		if (passada === "exaustas") {
			// Children terminados sem returnvalue (failed/exaustos) → consolida
			// pelo estado REAL da fatura (A2).
			return consolidarFaturaPorEstado(job as JobLike<EmitFaturaData>, deps);
		}
		// Primeira passada: fan-out. O parent é resolvido **por job** (closure
		// no ctx, não Map global) — seguro p/ concurrency>1 (ADR-0002).
		const res = await handleEmitFatura(job as JobLike<EmitFaturaData>, { ...deps, enqueueFilho: ctx.enqueueFilho });
		// Fan-out enfileirou children → o parent NÃO pode retornar normalmente
		// (BullMQ rejeitaria `moveToCompleted` com -4 JobPendingChildren →
		// queimaria attempts). Estaciona em `waiting-children`: o BullMQ reativa
		// o parent quando todos os children terminarem (2ª passada consolida).
		// `res.enfileiradas === 0` = M3 (consolidou agora, sem children) → retorna.
		if (res.enfileiradas > 0) await estacionarOuPronto(ctx);
		return res;
	}
	if (jobName === "emit-cobranca") {
		// emit-cobranca tem 2 passadas (M1), igual o parent: 1ª fan-out das
		// notas; 2ª (após notas completarem) coleta os ResultadoEmitNfcom e
		// devolve o ResultadoEmitCobranca final com notasOk[] reais.
		const childrenValues = await getChildrenValuesComRetry<ResultadoEmitNfcom>(ctx);
		const passada = await decidirPassadaEmissao(job, childrenValues);
		if (passada === "aguardar") {
			// Notas em andamento: estaciona em `waiting-children` (sem custo de
			// attempt). Se todas já terminaram (values ainda não visíveis),
			// consolida pelo estado real (A2).
			if (await estacionarOuPronto(ctx)) return consolidarCobrancaPorEstado(job as JobLike<EmitCobrancaData>, deps);
		}
		if (passada === "segunda") {
			return consolidarCobranca(job as JobLike<EmitCobrancaData>, childrenValues!, deps);
		}
		if (passada === "exaustas") {
			// Notas terminadas sem returnvalue (failed/exaustos) → deriva o
			// ResultadoEmitCobranca pelo estado REAL (A2): boleto pela key de
			// idempotência, notas pelos status persistidos.
			return consolidarCobrancaPorEstado(job as JobLike<EmitCobrancaData>, deps);
		}
		const res = await handleEmitCobranca(job as JobLike<EmitCobrancaData>, { ...deps, enqueueFilho: ctx.enqueueFilho });
		// Fan-out enfileirou notas → estaciona em `waiting-children` (mesmo
		// motivo do parent: retorno normal com children pendentes queima
		// attempts). `notasEnfileiradas === 0` = sem children → retorna.
		if (res.notasEnfileiradas > 0) await estacionarOuPronto(ctx);
		return res;
	}
	if (jobName === "emit-nfcom") {
		return handleEmitNfcom(job as JobLike<EmitNfcomData>, deps);
	}
	throw new ErroFatal(`job desconhecido na fila emissao: ${jobName}`);
}

// ============================================================
// Wiring BullMQ (camada fina — instância Workers/Flow no composition root)
// ============================================================

/**
 * Fábrica do worker de emissão. Cria os Workers BullMQ na fila `emissao` e
 * devolve handles p/ o composition root registrar + graceful shutdown.
 *
 * Nota: o wiring real do Flow (parent/child) usa `FlowProducer` do BullMQ; o
 * `enqueueFilho` dos handlers é conectado ao `addChild` do Flow. Esta fábrica
 * é o ponto de integração; a lógica vive nos handlers acima (testados sem Redis).
 */
export interface EmissaoWorkers {
	workers: import("bullmq").Worker[];
}

export function criarEmissaoWorker(deps: EmissaoDeps): EmissaoWorkers {
	// Wiring BullMQ (Fase 6). Import dinâmico: queues/redis puxam `#/env` no
	// top-level (env validation); as funções puras (handlers) acima são testáveis
	// sem .env. O composition root (src/index.ts) chama esta fábrica com env já
	// validado.
	//
	// Árvore do Flow (ADR-0002): emit-fatura (parent) → emit-cobranca (children)
	// → emit-nfcom (children do emit-cobranca). O BullMQ só completa o parent
	// quando TODOS os children transitivos resolvem (sucesso ou falha exausta).
	// Cada job tem 2 passadas: (1) fan-out (enfileira children) e move p/
	// waiting-children; (2) quando os children completam, reativa e consolida via
	// getChildrenValues — sem contador manual no SQLite (ADR-0002). Isso vale tanto
	// para `emit-fatura` (consolida a fatura) quanto para `emit-cobranca` (coleta os
	// ResultadoEmitNfcom → notasOk[], M1).

	const wiring = (async () => {
		const [{ Worker, FlowProducer }, { getQueue, WORKER_DEFAULTS }, { getRedis }, { QUEUE_NAMES, JOB_NAMES }] =
			await Promise.all([
				import("bullmq"),
				import("#/lib/queues"),
				import("#/lib/redis"),
				import("#/lib/queue-names"),
			]);
		const connection = getRedis();
		const flowProducer = new FlowProducer({ connection });
		const queue = getQueue(QUEUE_NAMES.EMISSAO);

		// enqueueFilho: adiciona um child ao Flow do parent. O parent é resolvido
		// **por job** (closure), não por Map global — seguro p/ concurrency>1: cada
		// job carrega o seu próprio parentKey, então duas árvores emitindo em paralelo
		// não sobrescrevem o parent uma da outra (ADR-0002). Ligamos o child ao parent
		// em andamento via `queue.add(..., { parent })`.
		const enqueueFilhoPara = (parent: { id: string; queue: string } | null) =>
			async (name: string, data: unknown): Promise<void> => {
				const jobName = name as (typeof JOB_NAMES)[keyof typeof JOB_NAMES];
				if (parent) {
					await queue.add(jobName, data, { ...WORKER_DEFAULTS, parent });
				} else {
					await queue.add(jobName, data, WORKER_DEFAULTS);
				}
			};

		const worker = new Worker(
			QUEUE_NAMES.EMISSAO,
			// 2º arg `token` (lock do worker) é repassado ao ctx p/ o parent
			// chamar `job.moveToWaitingChildren(token)` — o idiom BullMQ de
			// "pai espera children" sem custo de attempt (WaitingChildrenError).
			async (job, token) => {
				// M8: logs o erro final UMA vez com fila+jobId antes de re-propagar
				// (BullMQ retenta), no estilo do outbox.worker (ADR-0008).
				try {
					// A1: a decisão 1ª vs 2ª passada vive no `processarJobEmissao`
					// (testável sem Redis) — aqui só ligamos o job real do BullMQ ao
					// ctx (getChildrenValues/getDependencies do job; fan-out per-job via
					// `queue.add(..., { parent }`), seguro p/ concurrency>1 (ADR-0002).
					const ctx: WorkerCtx = {
						jobName: job.name as string,
						jobId: job.id ?? "",
						job: job as unknown as JobLike,
						getChildrenValues: <T>() => job.getChildrenValues<T>(),
						enqueueFilho: enqueueFilhoPara({ id: job.id ?? "", queue: queue.qualifiedName }),
						token: token ?? "",
					};
					return await processarJobEmissao(ctx, deps);
				} catch (err) {
					// WaitingChildrenError: NÃO é falha — é o idiom "pai espera
					// children" (moveToWaitingChildren). Re-propaga sem logar
					// (o worker BullMQ estaciona o job, sem custo de attempt).
					if (err instanceof WaitingChildrenError || (err instanceof Error && err.name === "WaitingChildrenError")) {
						throw err;
					}
					// M8: loga o erro final UMA vez com fila+jobId; re-propaga para o
					// BullMQ decidir retry (ErroRetryable) ou falha (ErroFatal/exausto).
					log.error(
						{ err, fila: "emissao", jobId: job.id ?? "" },
						"job falhou (BullMQ retenta) — erro de emissão",
					);
					throw err;
				}
			},
			{
				connection,
				...WORKER_DEFAULTS,
				// Sem limiter de fila: o rate-limit por gateway é aplicado na chamada
				// externa (src/lib/rate-limit.ts) — cada provedor com a sua env
				// (RATE_LIMIT_ASAAS/NFCOM/ATACADO). Limitar a fila estrangularia o Asaas
				// ao teto do NFCom sem o Flow poder separar as filas (ADR-0002).
				concurrency: 5,
			},
		);

		worker.on("error", (err) => {
			log.error({ err, fila: "emissao" }, "erro no worker de emissao");
		});

		return { worker, flowProducer, queue };
	})();

	// Retorno síncrono p/ a interface EmissaoWorkers: os handles são resolvidos
	// na primeira await do composition root. (BullMQ Worker é assíncrono p/ iniciar;
	// expomos uma promise p/ o root aguardar.)
	const workersPromise = wiring.then((w) => [w.worker] as import("bullmq").Worker[]);
	return {
		get workers() {
			// O composition root deve aguardar `wiring` antes de usar; expomos o
			// getter p/ satisfazer a interface. Em uso normal, `gracefulShutdown`
			// recebe os workers resolvidos.
			return workersPromise;
		},
	} as unknown as EmissaoWorkers;
}

/**
 * Consolida o estado final da fatura a partir dos children values do Flow
 * (segunda passada do parent). Os children de emit-fatura são os emit-cobranca,
 * cada um com `ResultadoEmitCobranca { boletoOk, notasOk[], erro? }` — onde
 * `notasOk[]` agora são os resultados REAIS dos emit-nfcom (grandchildren),
 * coletados na 2ª passada do emit-cobranca (M1) via getChildrenValues. Assim a
 * fatura consolida pela nota verdadeira (casos 7/10/11/18), não por uma
 * aproximação do boleto. Exportado p/ teste do contrato de consolidação por
 * grandchildren (M1) sem depender do Redis.
 */
export async function consolidarFaturaOuCobranca(
	job: { data: EmitFaturaData },
	childrenValues: Record<string, ResultadoEmitCobranca>,
	deps: EmissaoDeps,
): Promise<{ status: StatusFatura }> {
	const data = job.data as EmitFaturaData;
	const db = helperDb(deps.db);
	const resultados: ResultadoCobranca[] = Object.entries(childrenValues).map(([, v]) => ({
		cobrancaId: 0, // não temos o id mapeado aqui (children key é opaca)
		boletoOk: v.boletoOk,
		notasOk: v.notasOk ?? [],
	}));
	const status = consolidar(resultados);
	await consolidarFaturaEliberar(db, deps, data.faturaId, status);
	return { status };
}

/**
 * Escreve o status final da fatura (outbox + webhook) e libera o lease —
 * compartilhado pela consolidação via childrenValues (M1), pelo M3/A3 (0
 * a-emitir) e pelo fallback A2 (children exaustos).
 */
async function consolidarFaturaEliberar(
	db: EmissaoDeps["db"],
	deps: EmissaoDeps,
	faturaId: number,
	status: StatusFatura,
): Promise<void> {
	await enqueueOutbox(db, {
		aggregate: "fatura",
		aggregateId: faturaId,
		payload: { op: "atualizarStatusFatura", id: faturaId, status },
	});
	await enfileirarEventoWebhook(deps, {
		faturaId,
		tipo: "fatura.status",
		alvo: { faturaId },
		estado: status,
	});
	await releaseLease(db, faturaId);
	log.info({ faturaId, status }, "fatura consolidada");
}

/**
 * Fallback A2 do parent: 2ª passada sem `childrenValues` (todos os children
 * failed/exaustos — exaustos não produzem `returnvalue`). Recarrega a fatura
 * pelo estado REAL persistido (`atacado.getFaturaPorId`) e deriva
 * `ResultadoCobranca[]` dos status das cobranças/notas. O `childrenValues`
 * segue como fonte primária quando disponível (M1 — coleta via Flow,
 * ADR-0002); o estado do CRM é apenas o fallback.
 *
 * Defesa: sem fatura ou sem cobranças definidas (estado inesperado — nunca
 * houve children p/ falhar), remenda com `a-emitir` para não trancar o
 * lease com status de ciclo.
 */
export async function consolidarFaturaPorEstado(
	job: JobLike<EmitFaturaData>,
	deps: EmissaoDeps,
): Promise<{ status: StatusFatura }> {
	const db = helperDb(deps.db);
	const fatura = await deps.atacado.getFaturaPorId(job.data.faturaId);
	const resultados = fatura ? resultadosDaFatura(fatura) : [];
	if (!fatura || resultados.length === 0) {
		log.warn(
			{ faturaId: job.data.faturaId },
			"fallback A2: fatura sem cobranças definidas — remendando a-emitir (defesa do lease)",
		);
		await consolidarFaturaEliberar(db, deps, job.data.faturaId, "a-emitir");
		return { status: "a-emitir" };
	}
	const status = consolidar(resultados);
	await consolidarFaturaEliberar(db, deps, job.data.faturaId, status);
	return { status };
}

/**
 * Fallback A2 do `emit-cobranca`: 2ª passada sem `childrenValues` (notas
 * failed/exaustos). Deriva o `ResultadoEmitCobranca` pelo estado REAL: boleto
 * pela key de idempotência (resolved ⇒ emitido — mesma fonte do
 * `consolidarCobranca`) e notas pelos `statusInterno` persistidos da cobrança.
 */
export async function consolidarCobrancaPorEstado(
	job: JobLike<EmitCobrancaData>,
	deps: EmissaoDeps,
): Promise<ResultadoEmitCobranca> {
	const db = helperDb(deps.db);
	const d = job.data;
	const boleto = await acquireKey(db, `cobranca:${d.cobrancaId}:boleto`, "asaas");
	const boletoOk = boleto.status === "resolved";
	const notasOk: boolean[] = [];
	const fatura = await deps.atacado.getFaturaPorId(d.faturaId);
	const cobranca = fatura?.cobrancas.find((c) => c.id === d.cobrancaId);
	if (cobranca) {
		notasOk.push(...cobranca.notas.map((n) => n.statusInterno === "emitida"));
	} else {
		log.warn({ cobrancaId: d.cobrancaId }, "fallback A2: cobrança não encontrada na fatura — notasOk vazio");
	}
	log.info(
		{ cobrancaId: d.cobrancaId, boletoOk, notasOk: notasOk.length },
		"cobranca consolidada por estado real (2ª passada sem childrenValues)",
	);
	return { boletoOk, notasOk, erro: boletoOk ? undefined : "boleto não emitido" };
}
