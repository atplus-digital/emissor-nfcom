/**
 * Repositório Atacado — implementa `AtacadoPort` (ADR-0004).
 *
 * Criação da árvore: **direta com rollback manual** (SPEC-0002) — o chamador
 * (preparação) faz o rollback chamando `removerArvore` em falha; o outbox não
 * se aplica à criação (a resposta 201 precisa dos IDs agora).
 *
 * Atualizações de estado de emissão: escritas **diretas** aqui, mas o chamador
 * em produção é o dispatcher do outbox-relay (`src/workers/outbox.worker.ts`,
 * ADR-0003) — o worker de emissão enfileira e o relay invoca estas chamadas.
 * Idempotente: update por id suporta replay ao-menos-uma-vez (ADR-0003).
 *
 * Coleções NocoBase — a rota da API usa o **nome da tabela** (`t_*`), não o
 * nome amigável (ADR-0004):
 *   t_nfcom_faturas, t_nfcom_cobrancas, t_nfcom_notas, t_nfcom_itens,
 *   t_parceiros, t_clientes, t_planos_de_servico, t_nfcom_erros.
 */
import type {
	AtacadoPort,
	AtualizarStatusNotaInput,
	CriarCobrancaInput,
	CriarFaturaInput,
	CriarItemInput,
	CriarNotaInput,
	RegistrarErroInput,
} from "#/domain/ports/atacado.port";
import type { Cliente, Fatura, Parceiro, Plano } from "#/domain/types";
import type { AtacadoClient } from "./atacado.client";
import { AtacadoError } from "./atacado.client";
import { clienteToDomain, type ClienteExterno } from "./translators/cliente";
import {
	cobrancaToCreate,
	cobrancaToDomain,
	type CobrancaExterna,
} from "./translators/cobranca";
import { faturaToCreate, faturaToDomain, type FaturaExterna } from "./translators/fatura";
import { itemToCreate } from "./translators/item";
import { notaToCreate } from "./translators/nota";
import { parceiroToDomain, type ParceiroExterno } from "./translators/parceiro";

const COL = {
	faturas: "t_nfcom_faturas",
	cobrancas: "t_nfcom_cobrancas",
	notas: "t_nfcom_notas",
	itens: "t_nfcom_itens",
	parceiros: "t_parceiros",
	clientes: "t_clientes",
	planos: "t_planos_de_servico",
	erros: "t_nfcom_erros",
};

export class AtacadoRepository implements AtacadoPort {
	constructor(private readonly client: AtacadoClient) {}

	async buscarParceiroPorId(parceiroId: number): Promise<Parceiro | null> {
		try {
			const e = await this.client.get(COL.parceiros, { filterByTk: parceiroId });
			return parceiroToDomain(e as ParceiroExterno);
		} catch (err) {
			// 404 = registro não encontrado → null (a rota vira 422, SPEC-0002 caso 1).
			// Outros erros (5xx, etc.) propagam — são retryable/fatal no worker.
			if (err instanceof AtacadoError && err.statusCode === 404) return null;
			throw err;
		}
	}

	async buscarClientesAtivosPorParceiro(parceiroId: number): Promise<Cliente[]> {
		try {
			const rows = await this.client.list(COL.clientes, {
				filter: { f_fk_parceiro: parceiroId },
				appends: ["f_linhas_fixas", "f_linhas_fixas.f_planos_de_servico"],
			});
			return (rows as ClienteExterno[]).map(clienteToDomain);
		} catch (err) {
			// NocoBase responde 404 em `list` quando não há clientes do parceiro →
			// lista vazia (a rota vira 422 VALIDACAO, SPEC-0002 caso 2). Outros
			// erros (5xx, etc.) propagam — são retryable/fatal no worker.
			if (err instanceof AtacadoError && err.statusCode === 404) return [];
			throw err;
		}
	}

	async buscarPlanosDeServico(): Promise<Plano[]> {
		const rows = await this.client.list(COL.planos, {});
		return (rows as Array<{ id: number; f_nome: string; f_assinatura_mensal: number }>).map(
			(p) => ({
				id: p.id,
				descricao: p.f_nome,
				preco: Math.round(p.f_assinatura_mensal * 100),
			}),
		);
	}

	async buscarFaturaPorChave(parceiroId: number, dataReferencia: string): Promise<Fatura | null> {
		const rows = await this.client.list(COL.faturas, {
			filter: { f_fk_parceiro: parceiroId, f_data_referencia: dataReferencia },
			appends: [
				"f_cobrancas",
				"f_cobrancas.f_notas_fiscais",
				"f_cobrancas.f_notas_fiscais.f_nota_itens",
			],
		});
		const row = (rows as FaturaExterna[])[0];
		return row ? faturaToDomain(row) : null;
	}

	async getFaturaPorId(id: number): Promise<Fatura | null> {
		try {
			const e = await this.client.get(COL.faturas, {
				filterByTk: id,
				appends: [
					"f_cobrancas",
					"f_cobrancas.f_notas_fiscais",
					"f_cobrancas.f_notas_fiscais.f_nota_itens",
				],
			});
			return faturaToDomain(e as FaturaExterna);
		} catch (err) {
			// 404 = fatura não encontrada → null (a rota vira 404, POST /emitir).
			// Outros erros (5xx, etc.) propagam — são retryable/fatal no worker.
			if (err instanceof AtacadoError && err.statusCode === 404) return null;
			throw err;
		}
	}

	async criarFatura(input: CriarFaturaInput): Promise<{ id: number }> {
		const created = await this.client.create(COL.faturas, {
			...faturaToCreate(input),
		});
		return { id: created.id as number };
	}

	async criarCobranca(faturaId: number, input: CriarCobrancaInput): Promise<{ id: number }> {
		// NocoBase: a coleção filha valida `f_fatura is required` — enviar a FK
		// direta (`f_fk_fatura`) é rejeitado; é preciso usar o **nome da relação**
		// belongsTo (`f_fatura`), que o NocoBase resolve para a FK. Mesma regra
		// aplica-se a criarNota (f_cobranca) e criarItem (f_nota_fiscal).
		const created = await this.client.create(COL.cobrancas, {
			...cobrancaToCreate(input),
			f_fatura: faturaId,
		});
		return { id: created.id as number };
	}

	async criarNota(cobrancaId: number, input: CriarNotaInput): Promise<{ id: number }> {
		const created = await this.client.create(COL.notas, {
			...notaToCreate(input),
			f_cobranca: cobrancaId,
		});
		return { id: created.id as number };
	}

	async criarItem(notaId: number, input: CriarItemInput): Promise<void> {
		await this.client.create(COL.itens, {
			...itemToCreate(input),
			f_nota_fiscal: notaId,
		});
	}

	/**
	 * Remove a árvore de cobranças/notas/itens de uma fatura. **A fatura é
	 * reutilizada** no modo atualização (SPEC-0002 caso 6). Ordem: itens →
	 * notas → cobranças (evita órfãos de FK).
	 */
	async removerArvore(faturaId: number): Promise<void> {
		const faturas = await this.client.list(COL.faturas, {
			filterByTk: faturaId,
			appends: [
				"f_cobrancas",
				"f_cobrancas.f_notas_fiscais",
				"f_cobrancas.f_notas_fiscais.f_nota_itens",
			],
		});
		const fatura = (faturas as FaturaExterna[])[0];
		if (!fatura?.f_cobrancas) return;

		for (const cob of fatura.f_cobrancas as CobrancaExterna[]) {
			for (const nota of cob.f_notas_fiscais ?? []) {
				for (const item of nota.f_nota_itens ?? []) {
					if (item.id != null) await this.client.destroy(COL.itens, item.id);
				}
				if (nota.id != null) await this.client.destroy(COL.notas, nota.id);
			}
			if (cob.id != null) await this.client.destroy(COL.cobrancas, cob.id);
		}
	}

	async atualizarStatusFatura(id: number, status: import("#/domain/types").StatusFatura): Promise<void> {
		await this.client.update(COL.faturas, id, { f_status: status });
	}

	async atualizarStatusCobranca(
		id: number,
		status: import("#/domain/types").StatusCobranca,
		extra?: { idExterno?: string; linkFatura?: string; dataEmissao?: string },
	): Promise<void> {
		const body: Record<string, unknown> = { f_status: status };
		if (extra?.idExterno != null) body.f_id_externo = extra.idExterno;
		if (extra?.linkFatura != null) body.f_link_fatura = extra.linkFatura;
		if (extra?.dataEmissao != null) body.f_data_emissao = extra.dataEmissao;
		await this.client.update(COL.cobrancas, id, body);
	}

	async atualizarStatusNota(id: number, input: AtualizarStatusNotaInput): Promise<void> {
		const body: Record<string, unknown> = {};
		if (input.statusInterno != null) body.f_status_interno = input.statusInterno;
		if (input.situacao != null) body.f_situacao = input.situacao;
		if (input.numero != null) body.f_numero = input.numero;
		if (input.serie != null) body.f_serie = input.serie;
		if (input.chave != null) body.f_chave = input.chave;
		if (input.protocolo != null) body.f_protocolo = input.protocolo;
		if (input.ambiente != null) body.f_ambiente = input.ambiente;
		if (input.pdfUrl != null) body.f_pdf = input.pdfUrl;
		if (input.xmlUrl != null) body.f_xml = input.xmlUrl;
		if (input.pixUrl != null) body.f_qrcodepix = input.pixUrl;
		await this.client.update(COL.notas, id, body);
	}

	async registrarErro(input: RegistrarErroInput): Promise<void> {
		const body: Record<string, unknown> = {
			f_erro: input.erro,
			f_mensagem: input.mensagem,
		};
		if (input.cobrancaId != null) body.f_fk_cobranca = input.cobrancaId;
		if (input.notaId != null) body.f_fk_nfcom = input.notaId;
		if (input.statusCode != null) body.f_status_code = input.statusCode;
		await this.client.create(COL.erros, body);
	}
}
