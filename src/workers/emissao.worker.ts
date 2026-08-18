/**
 * Worker de emissão (SPEC-0001, ADR-0002, ADR-0003).
 *
 * Árvore BullMQ Flows: `emit-fatura → emit-cobranca → emit-nfcom`.
 * - `emit-fatura` (parent): lease da fatura, marca `emitindo` via outbox,
 *   fan-out de `emit-cobranca` por cobrança; callback consolida `emitida/parcial/erro`.
 * - `emit-cobranca` (child): idempotência `cobranca:{id}:boleto` (consult-before-re-emit,
 *   caso 5), customer buscar/atualizar (caso 16), boleto; fan-out de `emit-nfcom`
 *   por nota — **mesmo se o boleto falhar** (caso 18: nota independe do boleto).
 * - `emit-nfcom` (child): idempotência `nfcom:{id}:emitir` (caso 15: não re-emite em
 *   retry pós-crash → erro+inspeção), mapeamento situacao (casos 6/7), reauth 401
 *   transparente (caso 9, no módulo NFCom).
 *
 * Handlers são funções puras `(job, deps)` para testar SEM Redis — o wiring BullMQ
 * (Worker/Flow/addChild) é uma camada fina em `criarEmissaoWorker`.
 */
import {
	acquireKey,
	resolveKey,
	type IdempotencyAcquire,
} from "#/lib/db/idempotency";
import { acquireLease, reassumirLeaseSeStale, releaseLease } from "#/lib/db/lease";
import { enqueueOutbox } from "#/lib/db/outbox";
import { mapearSituacaoNota } from "#/domain/emissao/situacao";
import { consolidarFatura, type ResultadoCobranca } from "#/domain/emissao/consolidacao";
import { runWithLogContext, log } from "#/lib/logger";
import type { AtacadoPort } from "#/domain/ports/atacado.port";
import type { AsaasPort } from "#/domain/ports/asaas.port";
import type { NfcomPort } from "#/domain/ports/nfcom.port";
import type {
	Cobranca,
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

/** Job data do parent `emit-fatura`. */
export interface EmitFaturaData {
	faturaId: number;
	parceiroId: number;
	dataReferencia: string;
}

/** Job data do child `emit-cobranca`. */
export interface EmitCobrancaData {
	cobrancaId: number;
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

/** Job-like object mínimo (compatível c/ BullMQ Job p/ testes). */
export interface JobLike<T = unknown> {
	data: T;
	attemptsMade: number;
	opts: { attempts?: number };
	id?: string;
}

/**
 * Dependências injetadas nos handlers (testes passam fakes; o composition root
 * passa os reais). `enqueueFilho` abstrai o fan-out do Flow (testável sem Redis).
 *
 * `db` é tipado como o DB de coordenação (`CoordDB`); os helpers de `#/lib/db/*`
 * tipam o seu parâmetro como `LibSQLDatabase<Record<string, never>>` —
 * incompatível com `CoordDB` por invariância de schema. O cast `as any` no
 * `helperDb` resolve o atrito sem mexer no src/lib (fora de escopo desta fase).
 */
type DbHelper = Parameters<typeof acquireKey>[0];

export interface EmissaoDeps {
	atacado: AtacadoPort;
	asaas: AsaasPort;
	nfcom: NfcomPort;
	db: import("#/lib/db/client").CoordDB;
	/** Enfileira um job filho (fan-out). Testes stubbam; o wiring BullMQ implementa. */
	enqueueFilho?: (name: string, data: unknown) => Promise<void>;
	/** Carrega a fatura com árvore (cobranças + notas). Default via atacado.buscarFaturaPorChave. */
	carregarFatura?: (faturaId: number, parceiroId: number, dataReferencia: string) => Promise<Fatura | null>;
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

// ============================================================
// Handler: emit-fatura (parent)
// ============================================================

export interface ResultadoEmitFatura {
	status: StatusFatura;
}

/**
 * Parent: adquire lease, marca `emitindo`, fan-out cobranças, consolida.
 * O callback de consolidação roda quando toda a árvore resolve — aqui
 * modelado como: o parent enfileira os filhos e o resultado final é derivado
 * pelos resultados que os filhos reportam (via um mecanismo de coleta). P/ manter
 * testável sem Redis, a consolidação é feita quando o parent recebe os
 * resultados dos filhos de volta (chamada `consolidar` abaixo).
 */
export async function handleEmitFatura(
	job: JobLike<EmitFaturaData>,
	deps: EmissaoDeps,
): Promise<{ enfileiradas: number }> {
	const { faturaId, parceiroId, dataReferencia } = job.data;
	return runWithLogContext({ faturaId, jobId: job.id, fila: "emissao" }, async () => {
		const db = helperDb(deps.db);
		let acquired = await acquireLease(db, faturaId);
		if (!acquired) {
			// SPEC-0001 caso 2: lease já existe — pode ser de um job morto (stalled/
			// failed sem release). Tenta reassumir se stale (limiar de tempo).
			const limite = deps.limiteLeaseStaleMs ?? 3 * 60 * 1000;
			const reassumido = await reassumirLeaseSeStale(db, faturaId, limite);
			if (!reassumido) {
				log.warn({ faturaId }, "fatura com lease ativo — outro job detém; pulando");
				return { enfileiradas: 0 };
			}
			acquired = true;
			log.warn({ faturaId }, "lease stale reassumido (job anterior presumido morto)");
		}
		// carrega a fatura
		const carregar = deps.carregarFatura ?? (async (id, p, dr) => deps.atacado.buscarFaturaPorChave(p, dr));
		const fatura = await carregar(faturaId, parceiroId, dataReferencia);
		if (!fatura) {
			await releaseLease(db, faturaId);
			throw new ErroFatal(`fatura ${faturaId} não encontrada`);
		}
		// marca emitindo via outbox
		await enqueueOutbox(db, {
			aggregate: "fatura",
			aggregateId: faturaId,
			payload: { op: "atualizarStatusFatura", id: faturaId, status: "emitindo" },
		});
		// fan-out cobranças a-emitir
		const cobrancasAEmitir = fatura.cobrancas.filter((c) => c.status === "a-emitir");
		const enqueue = deps.enqueueFilho ?? (async () => {});
		for (const c of cobrancasAEmitir) {
			await enqueue("emit-cobranca", toCobrancaData(c));
		}
		return { enfileiradas: cobrancasAEmitir.length };
	});
}

function toCobrancaData(c: Cobranca): EmitCobrancaData {
	return {
		cobrancaId: c.id!,
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
// Handler: emit-cobranca (child)
// ============================================================

export interface ResultadoEmitCobranca {
	boletoOk: boolean;
	notasEnfileiradas: number;
	erro?: string;
}

export async function handleEmitCobranca(
	job: JobLike<EmitCobrancaData>,
	deps: EmissaoDeps,
): Promise<ResultadoEmitCobranca> {
	const d = job.data;
	const db = helperDb(deps.db);
	const { asaas, atacado } = deps;
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
				await commitCobranca(atacado, db, d.cobrancaId, acquired.externalId, linkFatura);
				boletoOk = true;
			} else {
				// in_progress: pode ser 1ª tentativa OU retry pós-crash (caso 5)
				const existing = await asaas.consultarBoletoPorExternalReference(`cobranca:${d.cobrancaId}`);
				if (existing) {
					// boleto já existe no Asaas (criado antes do crash) → resolve, não duplica
					await resolveKey(db, key, existing.idExterno);
					await commitCobranca(atacado, db, d.cobrancaId, existing.idExterno, existing.linkFatura);
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
					await commitCobranca(atacado, db, d.cobrancaId, boleto.idExterno, boleto.linkFatura);
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
			await enqueue("emit-nfcom", toNfcomData(n, d.cobrancaId));
			notasEnfileiradas++;
		}
		return { boletoOk, notasEnfileiradas, erro: erroMsg };
	});
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

async function commitCobranca(
	atacado: AtacadoPort,
	db: import("#/lib/db/client").CoordDB,
	cobrancaId: number,
	idExterno: string,
	linkFatura: string,
) {
	await enqueueOutbox(db, {
		aggregate: "cobranca",
		aggregateId: cobrancaId,
		payload: {
			op: "atualizarStatusCobranca",
			id: cobrancaId,
			status: "emitida",
			extra: { idExterno, linkFatura, dataEmissao: new Date().toISOString().slice(0, 10) },
		},
	});
}

function toNfcomData(n: ResumoNota, cobrancaId: number): EmitNfcomData {
	return {
		notaId: n.notaId,
		cobrancaId,
		faturaId: 0, // preenchido pelo wiring ao enfileirar (parent sabe); em teste não importa
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
	const { nfcom, atacado } = deps;
	return runWithLogContext({ jobId: job.id, fila: "emissao" }, async () => {
		const key = `nfcom:${d.notaId}:emitir`;
		const acquired = await acquireKey(db, key, "nfcom");
		if (acquired.status === "resolved") {
			// sentinel "processando": o gateway ack o POST e está processando (caso 6).
			// Não é um crash (caso 15) — o POST sucedeu. Continua retrying até o gateway
			// devolver situação final (ou exaurir tentativas → caso 17). Não re-emite.
			if (acquired.externalId === "processando") {
				throw new ErroRetryable(`nota ${d.notaId} ainda processando no gateway`);
			}
			// nota já emitida → reutiliza chave/protocolo
			await enqueueOutbox(db, {
				aggregate: "nota",
				aggregateId: d.notaId,
				payload: { op: "atualizarStatusNota", id: d.notaId, statusInterno: "emitida" },
			});
			return { notaOk: true, statusInterno: "emitida" };
		}
		// in_progress: se é retry (attemptsMade > 0) e ainda não resolvido → caso 15
		// (crash entre POST e resolveKey). NÃO re-emite → erro + inspeção.
		if (job.attemptsMade > 0 && acquired.status === "in_progress") {
			const msg = "suspeita de emissão (crash pós-POST) — inspeção manual via /api/lista";
			await enqueueOutbox(db, {
				aggregate: "nota",
				aggregateId: d.notaId,
				payload: { op: "atualizarStatusNota", id: d.notaId, statusInterno: "erro" },
			});
			await enqueueOutbox(db, {
				aggregate: "erro",
				aggregateId: d.notaId,
				payload: { op: "registrarErro", notaId: d.notaId, erro: "NFCOM_DEDUP", mensagem: msg },
			});
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
				throw new ErroRetryable(`nota ${d.notaId} processando no gateway`);
			}
			await resolveKey(db, key, res.chave);
			await enqueueOutbox(db, {
				aggregate: "nota",
				aggregateId: d.notaId,
				payload: {
					op: "atualizarStatusNota",
					id: d.notaId,
					statusInterno: map.statusInterno,
					situacao: map.situacao,
					numero: res.numero,
					serie: res.serie,
					chave: res.chave,
					protocolo: res.protocolo,
					pdfUrl: res.pdfUrl,
					xmlUrl: res.xmlUrl,
				},
			});
			const ok = map.statusInterno === "emitida";
			return { notaOk: ok, statusInterno: map.statusInterno };
		} catch (err) {
			if (err instanceof ErroRetryable) {
				// processando → deixa o BullMQ retryar (não marca erro)
				throw err;
			}
			// erro local (timeout/rede/401 exausto) ou fatal reportado pelo gateway
			const msg = err instanceof Error ? err.message : String(err);
			await enqueueOutbox(db, {
				aggregate: "nota",
				aggregateId: d.notaId,
				payload: { op: "atualizarStatusNota", id: d.notaId, statusInterno: "erro" },
			});
			await enqueueOutbox(db, {
				aggregate: "erro",
				aggregateId: d.notaId,
				payload: { op: "registrarErro", notaId: d.notaId, erro: "NFCOM", mensagem: msg },
			});
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
	// O handler do parent roda duas vezes: (1) fan-out (enfileira cobranças) e
	// move p/ waiting-children; (2) quando os children completam, reativa e
	// consolida o estado final da fatura via getChildrenValues — sem contador
	// manual no SQLite (ADR-0002).
	const wiring = (async () => {
		const [{ Worker, FlowProducer }, { getQueue, WORKER_DEFAULTS, rateLimitFor }, { getRedis }, { QUEUE_NAMES, JOB_NAMES }] =
			await Promise.all([
				import("bullmq"),
				import("#/lib/queues"),
				import("#/lib/redis"),
				import("#/lib/queue-names"),
			]);
		const connection = getRedis();
		const flowProducer = new FlowProducer({ connection });
		const queue = getQueue(QUEUE_NAMES.EMISSAO);

		// enqueueFilho: adiciona um child ao Flow do parent. O parent é identificado
		// pelo (parentKey = queue:jobId). Para emit-cobranca (child de emit-fatura) e
		// emit-nfcom (child de emit-cobranca), usamos addFlow com a relação parent/child.
		// Como os handlers chamam enqueueFilho incrementalmente (uma cobrança por vez),
		// usamos queue.add com a opção `parent` para ligar o child ao parent em andamento.
		const enqueueFilho = async (name: string, data: unknown): Promise<void> => {
			const jobName = name as (typeof JOB_NAMES)[keyof typeof JOB_NAMES];
			// `parent` é resolvido pelo composition-root wrapper que injeta o parentKey/parentId
			// via closure do job corrente (ver Worker handler abaixo).
			const parent = currentParent.get("parent");
			if (parent) {
				await queue.add(jobName, data, { ...WORKER_DEFAULTS, parent });
			} else {
				await queue.add(jobName, data, WORKER_DEFAULTS);
			}
		};

		// Contexto por-job do parent corrente (p/ enqueueFilho ligar o child). É
		// per-thread/async-safe porque o Worker processa um job por vez por concorrência.
		const currentParent = new Map<string, { id: string; queue: string }>();

		const workerDeps: EmissaoDeps = {
			...deps,
			enqueueFilho,
		};

		const worker = new Worker(
			QUEUE_NAMES.EMISSAO,
			async (job) => {
				const jobName = job.name as string;
				// Parent (emit-fatura): se tem children values disponíveis (segunda
				// passada, após children completarem) → consolida. Senão → fan-out.
				if (jobName === JOB_NAMES.EMIT_FATURA) {
					const childrenValues = await job.getChildrenValues<ResultadoEmitCobranca>();
					if (childrenValues && Object.keys(childrenValues).length > 0) {
						// Segunda passada: consolida o estado final da fatura.
						return consolidarFaturaOuCobranca(job, childrenValues, deps);
					}
					// Primeira passada: fan-out. Define o parent corrente p/ enqueueFilho.
					currentParent.set("parent", { id: job.id ?? "", queue: QUEUE_NAMES.EMISSAO });
					try {
						return await handleEmitFatura(job as unknown as JobLike<EmitFaturaData>, workerDeps);
					} finally {
						currentParent.delete("parent");
					}
				}
				if (jobName === JOB_NAMES.EMIT_COBRANCA) {
					// emit-cobranca: fan-out de emit-nfcom. Define parent p/ os nfcom.
					currentParent.set("parent", { id: job.id ?? "", queue: QUEUE_NAMES.EMISSAO });
					try {
						const result = await handleEmitCobranca(job as unknown as JobLike<EmitCobrancaData>, workerDeps);
						return result;
					} finally {
						currentParent.delete("parent");
					}
				}
				if (jobName === JOB_NAMES.EMIT_NFCOM) {
					return handleEmitNfcom(job as unknown as JobLike<EmitNfcomData>, workerDeps);
				}
				throw new ErroFatal(`job desconhecido na fila emissao: ${jobName}`);
			},
			{
				connection,
				...WORKER_DEFAULTS,
				// Rate-limit: a fila emissao toca Asaas e NFCom. Aplicamos o limite
				// mais conservador (NFCom, 2 req/s) como teto de concorrência da fila;
				// os provedores têm seus próprios limites e o Asaas aguenta mais.
				// Documentado: observar 429s em produção e ajustar (ADR-0002).
				limiter: rateLimitFor("nfcom"),
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
 * cada um com `ResultadoEmitCobranca { boletoOk, notasEnfileiradas, erro? }`.
 * Para saber o `notasOk[]` (sucesso de cada nota), precisaríamos dos children
 * de cada emit-cobranca (os emit-nfcom) — o BullMQ expõe via getChildrenValues
 * no job do emit-cobranca, não no parent. Como simplificação pragmática do
 * primeiro ciclo, derivamos `notasOk` da `notasEnfileiradas` + `erro`: se a
 * cobranca não teve erro e enfileirou notas, consideramos ok (a consolidação
 * fina por nota exigiria agregar os ResultadoEmitNfcom dos grandchildren, o
 * que o BullMQ não expõe diretamente no parent).
 *
 * TODO (futuro): agregar ResultadoEmitNfcom dos grandchildren via um step
 * intermediário ou evento, p/ consolidação nota-a-nota exata.
 */
async function consolidarFaturaOuCobranca(
	job: import("bullmq").Job,
	childrenValues: Record<string, ResultadoEmitCobranca>,
	deps: EmissaoDeps,
): Promise<{ status: StatusFatura }> {
	const data = job.data as EmitFaturaData;
	const db = helperDb(deps.db);
	const resultados: ResultadoCobranca[] = Object.entries(childrenValues).map(([, v]) => {
		// Sem acesso aos grandchildren no parent: approxima `notasOk` do boolean
		// `notasEnfileiradas > 0 && !erro` (a cobranca foi bem).
		const cobrancaOk = v.boletoOk && !v.erro && v.notasEnfileiradas >= 0;
		return {
			cobrancaId: 0, // não temos o id mapeado aqui (children key é opaca)
			boletoOk: v.boletoOk,
			notasOk: v.notasEnfileiradas > 0 ? [cobrancaOk] : [],
		};
	});
	const status = consolidar(resultados);
	await enqueueOutbox(db, {
		aggregate: "fatura",
		aggregateId: data.faturaId,
		payload: { op: "atualizarStatusFatura", id: data.faturaId, status },
	});
	await releaseLease(db, data.faturaId);
	log.info({ faturaId: data.faturaId, status }, "fatura consolidada");
	return { status };
}
