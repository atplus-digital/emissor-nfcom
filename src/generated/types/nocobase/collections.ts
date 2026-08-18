/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: bun run generate:types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */

import type { Clientes, ClientesRelations } from "./clientes";
import type { LinhasFixas, LinhasFixasRelations } from "./linhas-fixas";
import type {
	NfcomCobrancas,
	NfcomCobrancasRelations,
} from "./nfcom-cobrancas";
import type { NfcomErros, NfcomErrosRelations } from "./nfcom-erros";
import type { NfcomFaturas, NfcomFaturasRelations } from "./nfcom-faturas";
import type { NfcomItens, NfcomItensRelations } from "./nfcom-itens";
import type { NfcomNotas, NfcomNotasRelations } from "./nfcom-notas";
import type { AiEmployees, AiEmployeesRelations } from "./other/aiemployees";
import type {
	AnexosPortabilidadesDids,
	AnexosPortabilidadesDidsRelations,
} from "./other/anexos-portabilidades-dids";
import type {
	AnexosRespostas,
	AnexosRespostasRelations,
} from "./other/anexos-respostas";
import type {
	FAnexosServicos,
	FAnexosServicosRelations,
} from "./other/anexos-servicos";
import type {
	AnexosTickets,
	AnexosTicketsRelations,
} from "./other/anexos-tickets";
import type { Cdr, CdrRelations } from "./other/cdr";
import type {
	ComentariosServicos,
	ComentariosServicosRelations,
} from "./other/comentarios-servicos";
import type { Contato, ContatoRelations } from "./other/contato";
import type {
	ContratosIxc,
	ContratosIxcRelations,
} from "./other/contratos-ixc";
import type {
	ContratosIxcGeral,
	ContratosIxcGeralRelations,
} from "./other/contratos-ixc-geral";
import type { Departments, DepartmentsRelations } from "./other/departments";
import type { Dids, DidsRelations } from "./other/dids";
import type { Faturas, FaturasRelations } from "./other/faturas";
import type {
	IpEncaminhamento,
	IpEncaminhamentoRelations,
} from "./other/ip-encaminhamento";
import type {
	LinhaDigitavelPix,
	LinhaDigitavelPixRelations,
} from "./other/linha-digitavel-pix";
import type { Localidades, LocalidadesRelations } from "./other/localidades";
import type {
	NfcomItensAdicionais,
	NfcomItensAdicionaisRelations,
} from "./other/nfcom-itens-adicionais";
import type { Respostas, RespostasRelations } from "./other/respostas";
import type { Roles, RolesRelations } from "./other/roles";
import type {
	ServicosAdicionais,
	ServicosAdicionaisRelations,
} from "./other/servicos-adicionais";
import type {
	SolicitacoesNumeracao,
	SolicitacoesNumeracaoRelations,
} from "./other/solicitacoes-numeracao";
import type { TagsTickets, TagsTicketsRelations } from "./other/tags-tickets";
import type { Tarifas, TarifasRelations } from "./other/tarifas";
import type {
	TemplatesTickets,
	TemplatesTicketsRelations,
} from "./other/templates-tickets";
import type { Tickets, TicketsRelations } from "./other/tickets";
import type { Parceiros, ParceirosRelations } from "./parceiros";
import type {
	PlanosDeServico,
	PlanosDeServicoRelations,
} from "./planos-de-servico";
import type { Users, UsersRelations } from "./users";

// Tipo union com todas as collections disponíveis
export type CollectionName =
	| "aiEmployees"
	| "departments"
	| "f_anexos_servicos"
	| "roles"
	| "t_anexos_portabilidades_dids"
	| "t_anexos_respostas"
	| "t_anexos_tickets"
	| "t_cdr"
	| "t_clientes"
	| "t_comentarios_servicos"
	| "t_contato"
	| "t_contratos_ixc"
	| "t_contratos_ixc_geral"
	| "t_dids"
	| "t_faturas"
	| "t_ip_encaminhamento"
	| "t_linha_digitavel_pix"
	| "t_linhas_fixas"
	| "t_localidades"
	| "t_nfcom_cobrancas"
	| "t_nfcom_erros"
	| "t_nfcom_faturas"
	| "t_nfcom_itens"
	| "t_nfcom_itens_adicionais"
	| "t_nfcom_notas"
	| "t_parceiros"
	| "t_planos_de_servico"
	| "t_respostas"
	| "t_servicos_adicionais"
	| "t_solicitacoes_numeracao"
	| "t_tags_tickets"
	| "t_tarifas"
	| "t_templates_tickets"
	| "t_tickets"
	| "users";

export interface CollectionMap {
	aiEmployees: AiEmployees;
	departments: Departments;
	f_anexos_servicos: FAnexosServicos;
	roles: Roles;
	t_anexos_portabilidades_dids: AnexosPortabilidadesDids;
	t_anexos_respostas: AnexosRespostas;
	t_anexos_tickets: AnexosTickets;
	t_cdr: Cdr;
	t_clientes: Clientes;
	t_comentarios_servicos: ComentariosServicos;
	t_contato: Contato;
	t_contratos_ixc: ContratosIxc;
	t_contratos_ixc_geral: ContratosIxcGeral;
	t_dids: Dids;
	t_faturas: Faturas;
	t_ip_encaminhamento: IpEncaminhamento;
	t_linha_digitavel_pix: LinhaDigitavelPix;
	t_linhas_fixas: LinhasFixas;
	t_localidades: Localidades;
	t_nfcom_cobrancas: NfcomCobrancas;
	t_nfcom_erros: NfcomErros;
	t_nfcom_faturas: NfcomFaturas;
	t_nfcom_itens: NfcomItens;
	t_nfcom_itens_adicionais: NfcomItensAdicionais;
	t_nfcom_notas: NfcomNotas;
	t_parceiros: Parceiros;
	t_planos_de_servico: PlanosDeServico;
	t_respostas: Respostas;
	t_servicos_adicionais: ServicosAdicionais;
	t_solicitacoes_numeracao: SolicitacoesNumeracao;
	t_tags_tickets: TagsTickets;
	t_tarifas: Tarifas;
	t_templates_tickets: TemplatesTickets;
	t_tickets: Tickets;
	users: Users;
}

export interface CollectionRelationsMap {
	aiEmployees: AiEmployeesRelations;
	departments: DepartmentsRelations;
	f_anexos_servicos: FAnexosServicosRelations;
	roles: RolesRelations;
	t_anexos_portabilidades_dids: AnexosPortabilidadesDidsRelations;
	t_anexos_respostas: AnexosRespostasRelations;
	t_anexos_tickets: AnexosTicketsRelations;
	t_cdr: CdrRelations;
	t_clientes: ClientesRelations;
	t_comentarios_servicos: ComentariosServicosRelations;
	t_contato: ContatoRelations;
	t_contratos_ixc: ContratosIxcRelations;
	t_contratos_ixc_geral: ContratosIxcGeralRelations;
	t_dids: DidsRelations;
	t_faturas: FaturasRelations;
	t_ip_encaminhamento: IpEncaminhamentoRelations;
	t_linha_digitavel_pix: LinhaDigitavelPixRelations;
	t_linhas_fixas: LinhasFixasRelations;
	t_localidades: LocalidadesRelations;
	t_nfcom_cobrancas: NfcomCobrancasRelations;
	t_nfcom_erros: NfcomErrosRelations;
	t_nfcom_faturas: NfcomFaturasRelations;
	t_nfcom_itens: NfcomItensRelations;
	t_nfcom_itens_adicionais: NfcomItensAdicionaisRelations;
	t_nfcom_notas: NfcomNotasRelations;
	t_parceiros: ParceirosRelations;
	t_planos_de_servico: PlanosDeServicoRelations;
	t_respostas: RespostasRelations;
	t_servicos_adicionais: ServicosAdicionaisRelations;
	t_solicitacoes_numeracao: SolicitacoesNumeracaoRelations;
	t_tags_tickets: TagsTicketsRelations;
	t_tarifas: TarifasRelations;
	t_templates_tickets: TemplatesTicketsRelations;
	t_tickets: TicketsRelations;
	users: UsersRelations;
}

// Lista de todas as collections (para uso em runtime)
export const COLLECTIONS = [
	"aiEmployees",
	"departments",
	"f_anexos_servicos",
	"roles",
	"t_anexos_portabilidades_dids",
	"t_anexos_respostas",
	"t_anexos_tickets",
	"t_cdr",
	"t_clientes",
	"t_comentarios_servicos",
	"t_contato",
	"t_contratos_ixc",
	"t_contratos_ixc_geral",
	"t_dids",
	"t_faturas",
	"t_ip_encaminhamento",
	"t_linha_digitavel_pix",
	"t_linhas_fixas",
	"t_localidades",
	"t_nfcom_cobrancas",
	"t_nfcom_erros",
	"t_nfcom_faturas",
	"t_nfcom_itens",
	"t_nfcom_itens_adicionais",
	"t_nfcom_notas",
	"t_parceiros",
	"t_planos_de_servico",
	"t_respostas",
	"t_servicos_adicionais",
	"t_solicitacoes_numeracao",
	"t_tags_tickets",
	"t_tarifas",
	"t_templates_tickets",
	"t_tickets",
	"users",
] as const;
