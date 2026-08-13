/**
 * Padrões para categorização de campos na ordenação customizada do output.
 *
 * NOTA: Estes padrões são usados APENAS para ordenação dos campos no output.
 * A inclusão/exclusão de campos é determinada pela API do NocoBase, não por estes padrões.
 * Campos de sistema (createdById, updatedById, etc.) só aparecem se a API os retornar.
 */
const SORT_PATTERNS = {
	/** Chaves primárias e de identificação (id, sort, uid, etc.) */
	ID: /^(id|sort|uid)$/i,
	/** Chaves estrangeiras de relação (f_fk_*) */
	FK: /^f_fk_/i,
	/** Identificadores técnicos (f_id_*_ixc) */
	TECH_ID: /^f_id_.*_ixc$/i,
	/** Campos de auditoria - atualização (updatedBy, updatedAt) */
	AUDIT_UPDATE: /^updated(byid|at)$/i,
	/** Campos de auditoria - criação (createdBy, createdAt) */
	AUDIT_CREATE: /^created(byid|at)$/i,
} as const;

type FieldCategory =
	| "id"
	| "fk"
	| "tech_id"
	| "audit_update"
	| "audit_create"
	| "other";

/**
 * Categoriza um campo para fins de ordenação.
 *
 * Ordem de prioridade:
 * 1. id (campos primários)
 * 2. fk (chaves estrangeiras f_fk_*)
 * 3. tech_id (identificadores técnicos f_id_*_ixc)
 * 4. other (demais propriedades)
 * 5. audit_update (updatedById, updatedAt)
 * 6. audit_create (createdById, createdAt)
 */
function _categorizeField(fieldName: string): FieldCategory {
	const name = fieldName;
	if (SORT_PATTERNS.ID.test(name)) return "id";
	if (SORT_PATTERNS.FK.test(name)) return "fk";
	if (SORT_PATTERNS.TECH_ID.test(name)) return "tech_id";
	if (SORT_PATTERNS.AUDIT_UPDATE.test(name)) return "audit_update";
	if (SORT_PATTERNS.AUDIT_CREATE.test(name)) return "audit_create";
	return "other";
}

/** Ordem de prioridade para cada categoria (menor = aparece primeiro) */
const CATEGORY_ORDER: Record<FieldCategory, number> = {
	id: 0,
	fk: 1,
	tech_id: 2,
	other: 3,
	audit_update: 4,
	audit_create: 5,
};

/**
 * Ordena entries do Map de scalars com ordem customizada:
 * id → f_fk_* → f_id_*_ixc → demais → updatedBy/At → createdBy/At
 * Dentro de cada categoria, mantém ordem alfabética.
 */
export function _sortScalarEntries<T>(map: Map<string, T>): [string, T][] {
	return Array.from(map.entries()).sort(([a], [b]) => {
		const catA = _categorizeField(a);
		const catB = _categorizeField(b);
		const orderDiff = CATEGORY_ORDER[catA] - CATEGORY_ORDER[catB];
		if (orderDiff !== 0) return orderDiff;
		return a.localeCompare(b);
	});
}

export function _sortMapEntries<T>(map: Map<string, T>): [string, T][] {
	return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
}
