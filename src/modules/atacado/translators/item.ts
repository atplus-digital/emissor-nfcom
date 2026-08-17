/**
 * Translator Item: domínio `Item` ↔ `f_*` (t_nfcom_itens) — ADR-0004.
 */
import type { Item } from "#/domain/types";
import type { CriarItemInput } from "#/domain/ports/atacado.port";
import { centsToReal, realToCents } from "./money";

export interface ItemExterno {
	id?: number;
	f_item?: number;
	f_codigo?: string;
	f_descricao: string;
	f_cfop: string;
	f_cclass: string;
	f_quantidade: number;
	f_unitario: number;
	f_total: number;
	f_aliq_icms: number;
	f_bc_icms: number;
	f_icms: number;
	f_incide_aliquota: boolean;
}

export function itemToCreate(input: CriarItemInput): Record<string, unknown> {
	return {
		f_codigo: input.codigo ?? "",
		f_descricao: input.descricao,
		f_cfop: input.cfop,
		f_cclass: input.cclass,
		f_quantidade: input.quantidade,
		f_unitario: centsToReal(input.unitario),
		f_total: centsToReal(input.total),
		f_aliq_icms: input.aliqIcms,
		f_bc_icms: centsToReal(input.bcIcms),
		f_icms: centsToReal(input.icms),
		f_incide_aliquota: input.incideAliquota,
	};
}

export function itemToDomain(e: ItemExterno): Item {
	return {
		item: e.f_item,
		codigo: e.f_codigo,
		descricao: e.f_descricao,
		cfop: e.f_cfop,
		cclass: e.f_cclass,
		quantidade: e.f_quantidade,
		unitario: realToCents(e.f_unitario),
		total: realToCents(e.f_total),
		aliqIcms: e.f_aliq_icms,
		bcIcms: realToCents(e.f_bc_icms),
		icms: realToCents(e.f_icms),
		incideAliquota: e.f_incide_aliquota,
	};
}
