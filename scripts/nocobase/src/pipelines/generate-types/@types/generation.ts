export type RelationInterface =
	| "belongsTo"
	| "hasMany"
	| "m2m"
	| "mbm"
	| "belongsToArray"
	| "hasOne"
	| "m2o"
	| "o2m"
	| "manyToMany"
	| "oho"
	| "obo";

export type RelationCardinality = "one" | "many";

export interface RelationInfo {
	type: RelationInterface;
	/** Collection de destino (pode estar vazia se não disponível no datasource) */
	targetCollection: string;
	/** Target original antes da limpeza (sempre presente se definido) */
	originalTarget?: string;
}

export interface EnumOption {
	value: string | number;
	label: string;
}

export interface GeneratedTypes {
	scalars: Map<string, string>;
	relations: Map<string, RelationInfo>;
	enums: Map<string, EnumOption[]>;
	fieldLabels: Map<string, string>;
	/** `collection.title` do NocoBase (fallback: nome técnico da collection) */
	tableLabel: string;
	/**
	 * Indica se o schema da collection foi obtido com sucesso pela rota primária.
	 * `false` significa que a rota primária falhou (ex: 404) e foi usado fallback via sample.
	 * Usado para decidir se a inferência de enums deve rodar como fallback.
	 */
	schemaAvailable: boolean;
}

export type CollectionTypesMap = Record<string, GeneratedTypes>;
