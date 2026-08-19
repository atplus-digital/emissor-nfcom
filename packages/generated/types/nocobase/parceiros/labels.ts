/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: bun run generate:types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */

import { z } from "zod";

// ============================================================
// LABELS (single source of truth)
// ============================================================
export const PARCEIROS_FIELD_LABELS = {
	createdAt: "Criado em",
	createdBy: "Criado por",
	createdById: "createdById",
	f_bairro: "Bairro",
	f_cep: "CEP",
	f_cidade: "Cidade",
	f_cnpj: "CNPJ",
	f_contratossippulse: "Contratos SIP Pulse",
	f_data_vencimento: "Data de Vencimento",
	f_email_faturamento: "E-mail Faturamento",
	f_endereco: "Endereço",
	f_fantasia: "Nome Fantasia",
	f_faturas: "Faturas",
	f_fk_clientes: "Clientes",
	f_fk_planos_servico: "f_fk_planos_servico",
	f_fk_usuarios: "f_fk_usuarios",
	f_id_asaas: "ID Asaas",
	f_ie: "Inscrição Estadual",
	f_ip_encaminhamento: "IP de Encaminhamento",
	f_nfcom_faturas: "Faturas (NFcom)",
	f_numero: "Numero",
	f_planos_de_servico: "Planos de Serviço",
	f_razao_social: "Razão Social",
	f_solicitacoes_de_numeracao: "Solicitações de Numeração",
	f_telefone: "Telefone",
	f_tickets: "Tickets",
	f_uf: "UF",
	f_usuarios: "Usuarios",
	id: "ID",
	updatedAt: "Última atualização em",
	updatedBy: "Última atualização por",
	updatedById: "updatedById",
} as const;

export const FIELD_LABELS = PARCEIROS_FIELD_LABELS;

export const PARCEIROS_CONTRATOSSIPPULSE_LABELS = {
	8010550: "8010550",
	redesul: "redesul",
	9999870: "9999870",
	9999882: "9999882",
	8010155: "8010155",
	8010292: "8010292",
	meganet: "meganet",
	ask: "ask",
	hypernova: "hypernova",
	800001: "800001",
	"GD Telecom": "GD Telecom",
	8010298: "8010298",
	800002: "800002",
	800003: "800003",
	800004: "800004",
	800005: "800005",
	800006: "800006",
	800007: "800007",
} as const;

export const PARCEIROS_IP_ENCAMINHAMENTO_LABELS = {
	"191.6.79.228": "191.6.79.228",
	"45.229.107.104": "45.229.107.104",
	"186.209.116.237": "186.209.116.237",
	"45.229.104.105": "45.229.104.105",
	"168.195.96.22": "168.195.96.22",
	"177.10.89.16": "177.10.89.16",
	"177.10.89.217": "177.10.89.217",
	"168.0.27.249": "168.0.27.249",
	"45.229.107.98": "45.229.107.98",
	"45.163.12.124": "45.163.12.124",
	"45.230.32.169": "45.230.32.169",
	"45.229.107.78": "45.229.107.78",
	"104.234.90.33": "104.234.90.33",
	"177.10.89.137": "177.10.89.137",
	"104.234.90.83": "104.234.90.83",
	"45.230.32.135": "45.230.32.135",
	"177.10.89.7": "177.10.89.7",
	"45.6.116.105": "45.6.116.105",
	"177.10.89.98": "177.10.89.98",
	"177.10.89.69": "177.10.89.69",
	"177.10.89.210": "177.10.89.210",
	"201.131.180.21": "201.131.180.21",
	"170.0.116.250": "170.0.116.250",
	"179.127.116.34": "179.127.116.34",
	"189.45.197.67": "189.45.197.67",
	"191.252.196.135": "191.252.196.135",
} as const;

export const ENUM_LABELS_BY_FIELD = {
	f_contratossippulse: PARCEIROS_CONTRATOSSIPPULSE_LABELS,
	f_ip_encaminhamento: PARCEIROS_IP_ENCAMINHAMENTO_LABELS,
} as const;

// ============================================================
// ENUM SCHEMAS (validação em runtime)
// ============================================================
export const parceirosContratossippulseSchema = z.enum(
	[
		"8010550",
		"redesul",
		"9999870",
		"9999882",
		"8010155",
		"8010292",
		"meganet",
		"ask",
		"hypernova",
		"800001",
		"GD Telecom",
		"8010298",
		"800002",
		"800003",
		"800004",
		"800005",
		"800006",
		"800007",
	],
	{
		error: () => ({
			message:
				"contratossippulse: valores válidos são [8010550, redesul, 9999870, 9999882, 8010155, 8010292, meganet, ask, hypernova, 800001, GD Telecom, 8010298, 800002, 800003, 800004, 800005, 800006, 800007]",
		}),
	},
);

export const parceirosIpEncaminhamentoSchema = z.enum(
	[
		"191.6.79.228",
		"45.229.107.104",
		"186.209.116.237",
		"45.229.104.105",
		"168.195.96.22",
		"177.10.89.16",
		"177.10.89.217",
		"168.0.27.249",
		"45.229.107.98",
		"45.163.12.124",
		"45.230.32.169",
		"45.229.107.78",
		"104.234.90.33",
		"177.10.89.137",
		"104.234.90.83",
		"45.230.32.135",
		"177.10.89.7",
		"45.6.116.105",
		"177.10.89.98",
		"177.10.89.69",
		"177.10.89.210",
		"201.131.180.21",
		"170.0.116.250",
		"179.127.116.34",
		"189.45.197.67",
		"191.252.196.135",
	],
	{
		error: () => ({
			message:
				"ip_encaminhamento: valores válidos são [191.6.79.228, 45.229.107.104, 186.209.116.237, 45.229.104.105, 168.195.96.22, 177.10.89.16, 177.10.89.217, 168.0.27.249, 45.229.107.98, 45.163.12.124, 45.230.32.169, 45.229.107.78, 104.234.90.33, 177.10.89.137, 104.234.90.83, 45.230.32.135, 177.10.89.7, 45.6.116.105, 177.10.89.98, 177.10.89.69, 177.10.89.210, 201.131.180.21, 170.0.116.250, 179.127.116.34, 189.45.197.67, 191.252.196.135]",
		}),
	},
);

// ============================================================
// ENUM TYPES (inferidos dos schemas)
// ============================================================
export type ParceirosContratossippulse = z.infer<
	typeof parceirosContratossippulseSchema
>;

export type ParceirosIpEncaminhamento = z.infer<
	typeof parceirosIpEncaminhamentoSchema
>;
