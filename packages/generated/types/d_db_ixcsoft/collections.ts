/**
 * Arquivo gerado automaticamente
 * NÃO EDITAR MANUALMENTE - usar: bun run generate:types
 * biome-ignore-all lint/suspicious/noEmptyInterface: auto-generated
 */

import type { Cliente, ClienteRelations } from "./cliente";
import type {
	ClienteContrato,
	ClienteContratoRelations,
} from "./cliente-contrato";
import type { Cidade, CidadeRelations } from "./other/cidade";
import type {
	ClienteContratoTipo,
	ClienteContratoTipoRelations,
} from "./other/cliente-contrato-tipo";
import type { FnAreceber, FnAreceberRelations } from "./other/fn-areceber";
import type {
	VdContratosProdutos,
	VdContratosProdutosRelations,
} from "./other/vd-contratos-produtos";

// Tipo union com todas as collections disponíveis
export type CollectionName =
	| "cidade"
	| "cliente"
	| "cliente_contrato"
	| "cliente_contrato_tipo"
	| "fn_areceber"
	| "vd_contratos_produtos";

export interface CollectionMap {
	cidade: Cidade;
	cliente: Cliente;
	cliente_contrato: ClienteContrato;
	cliente_contrato_tipo: ClienteContratoTipo;
	fn_areceber: FnAreceber;
	vd_contratos_produtos: VdContratosProdutos;
}

export interface CollectionRelationsMap {
	cidade: CidadeRelations;
	cliente: ClienteRelations;
	cliente_contrato: ClienteContratoRelations;
	cliente_contrato_tipo: ClienteContratoTipoRelations;
	fn_areceber: FnAreceberRelations;
	vd_contratos_produtos: VdContratosProdutosRelations;
}

// Lista de todas as collections (para uso em runtime)
export const COLLECTIONS = [
	"cidade",
	"cliente",
	"cliente_contrato",
	"cliente_contrato_tipo",
	"fn_areceber",
	"vd_contratos_produtos",
] as const;
