/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: bun run generate:types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */

import { z } from "zod";

// ============================================================
// LABELS (single source of truth)
// ============================================================
export const TICKETS_FIELD_LABELS = {
	createdAt: "Criado em",
	createdBy: "Criado por",
	createdById: "createdById",
	f_anexos: "Anexos",
	f_b2v3ctc7rds: "f_b2v3ctc7rds",
	f_clientes: "Clientes",
	f_data_teste: "Data e Hora do Teste",
	f_departamento: "Departamento",
	f_k2gur7mlcvv: "f_k2gur7mlcvv",
	f_linhasfixas: "Linhas Fixas",
	f_localidades: "Localidades",
	f_mensagem_inicial: "Mensagem Inicial",
	f_na: "Número de Origem (NA)",
	f_nb: "Número de Destino (NB)",
	f_obs_internas: "Notas Internas",
	f_parceiro: "Parceiro",
	f_responsavel: "f_responsavel",
	f_responsavel2: "Responsável",
	f_status: "Status",
	f_tags: "TAGS",
	f_tags_tickets: "Tags",
	f_tipo_solicitacao: "Tipo de Solicitação",
	f_titulo: "Título",
	id: "ID",
	updatedAt: "Última atualização em",
	updatedBy: "Última atualização por",
	updatedById: "updatedById",
} as const;

export const FIELD_LABELS = TICKETS_FIELD_LABELS;

export const TICKETS_DEPARTAMENTO_LABELS = {
	1: "Atendimento Financeiro",
	2: "Numeração Telefonia",
	3: "Suporte Telefonia",
} as const;

export const TICKETS_STATUS_LABELS = {
	1: "Aberto",
	2: "Respondido",
	3: "Em Progresso",
	4: "Fechado",
	5: "Portabilidade Solicitada",
	6: "Portabilidade Autorizada",
	7: "Conflito de Dados",
	8: "Solicitação Concluída",
	9: "Respondido pelo Parceiro",
} as const;

export const TICKETS_TAGS_LABELS = {
	1: "FALHA MASSIVA",
	2: "BA ABERTO",
	3: "AGUARDANDO VALIDAÇÃO DO CLIENTE",
	4: "TICKET LIGUEAI",
	5: "TICKET TIP",
	6: "BA ABERTO OI",
	7: "BA ABERTO TIM",
	8: "BA ABERTO CLARO",
	9: "BA ABERTO VIVO",
	10: "ESCALONADO ZICTEC",
	11: "LIGUEAI",
	12: "TESTES EM CONJUNTO",
	13: "Em contato com ITX Datora",
	14: "Em contato com ITX Tim",
	15: "Em contato com ITX Hub",
	16: "Em contato com ITX Unifique",
	17: "Em contato com ITX Vivo",
	18: "Em contato com ITX Interip",
	19: "Em contato com ITX Claro",
	20: "Em contato com ITX Telecall",
} as const;

export const TICKETS_TIPO_SOLICITACAO_LABELS = {
	1: "Não recebe chamadas",
	2: "Não faz chamadas",
	3: "Picotes",
	4: "Quedas",
	5: "Outro",
	6: "PABX",
} as const;

export const ENUM_LABELS_BY_FIELD = {
	f_departamento: TICKETS_DEPARTAMENTO_LABELS,
	f_status: TICKETS_STATUS_LABELS,
	f_tags: TICKETS_TAGS_LABELS,
	f_tipo_solicitacao: TICKETS_TIPO_SOLICITACAO_LABELS,
} as const;

// ============================================================
// ENUM SCHEMAS (validação em runtime)
// ============================================================
export const ticketsDepartamentoSchema = z.enum(["1", "2", "3"], {
	error: () => ({
		message:
			"departamento: valores válidos são [Atendimento Financeiro, Numeração Telefonia, Suporte Telefonia]",
	}),
});

export const ticketsStatusSchema = z.enum(
	["1", "2", "3", "4", "5", "6", "7", "8", "9"],
	{
		error: () => ({
			message:
				"status: valores válidos são [Aberto, Respondido, Em Progresso, Fechado, Portabilidade Solicitada, Portabilidade Autorizada, Conflito de Dados, Solicitação Concluída, Respondido pelo Parceiro]",
		}),
	},
);

export const ticketsTagsSchema = z.enum(
	[
		"1",
		"2",
		"3",
		"4",
		"5",
		"6",
		"7",
		"8",
		"9",
		"10",
		"11",
		"12",
		"13",
		"14",
		"15",
		"16",
		"17",
		"18",
		"19",
		"20",
	],
	{
		error: () => ({
			message:
				"tags: valores válidos são [FALHA MASSIVA, BA ABERTO, AGUARDANDO VALIDAÇÃO DO CLIENTE, TICKET LIGUEAI, TICKET TIP, BA ABERTO OI, BA ABERTO TIM, BA ABERTO CLARO, BA ABERTO VIVO, ESCALONADO ZICTEC, LIGUEAI, TESTES EM CONJUNTO, Em contato com ITX Datora, Em contato com ITX Tim, Em contato com ITX Hub, Em contato com ITX Unifique, Em contato com ITX Vivo, Em contato com ITX Interip, Em contato com ITX Claro, Em contato com ITX Telecall]",
		}),
	},
);

export const ticketsTipoSolicitacaoSchema = z.enum(
	["1", "2", "3", "4", "5", "6"],
	{
		error: () => ({
			message:
				"tipo_solicitacao: valores válidos são [Não recebe chamadas, Não faz chamadas, Picotes, Quedas, Outro, PABX]",
		}),
	},
);

// ============================================================
// ENUM TYPES (inferidos dos schemas)
// ============================================================
export type TicketsDepartamento = z.infer<typeof ticketsDepartamentoSchema>;

export type TicketsStatus = z.infer<typeof ticketsStatusSchema>;

export type TicketsTags = z.infer<typeof ticketsTagsSchema>;

export type TicketsTipoSolicitacao = z.infer<
	typeof ticketsTipoSolicitacaoSchema
>;
