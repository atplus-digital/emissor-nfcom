export interface BaseInterfaceNamingConfig {
	prefix: string;
	suffix: string;
}

/**
 * Definição de relação manual para datasource.
 * Usado para mapear explicitamente campos de relação que não são detectados automaticamente.
 */
export interface ManualRelationMapping {
	[fieldName: string]: {
		/** Collection alvo da relação */
		target: string;
		/** Tipo de relação (belongsTo, hasMany, m2m, hasOne) */
		type: "belongsTo" | "hasMany" | "m2m" | "hasOne";
	};
}

interface BaseDataSourceGenerationConfig {
	name: string;
	dataSource: string;
	/**
	 * Inclui todas as collections retornadas pela API do datasource.
	 * Collections explícitas e splitCollections continuam sendo respeitadas
	 * (split apenas altera onde o arquivo é escrito).
	 * @default false
	 */
	includeAllCollections?: boolean;
	/**
	 * Quando includeAllCollections estiver desabilitado, inclui automaticamente
	 * collections relacionadas às splitCollections.
	 * As dependentes entram como não-split (pasta "other").
	 * @default false
	 */
	includeDependents?: boolean;
	/**
	 * Diretório de saída opcional por datasource.
	 * Quando omitido, o script deriva automaticamente de ScriptConfig.outputDir
	 * usando a chave dataSource (ex: "main" -> "nocobase").
	 */
	outputDir?: string;
	splitCollections?: string[];
	/**
	 * Lista opcional de campos a excluir da geração para esta datasource.
	 * Útil para remover campos sistêmicos herdados da API que não fazem parte
	 * do contrato esperado da aplicação.
	 */
	excludeFields?: string[];
	collections?: string[];
	baseInterfaceNaming?: BaseInterfaceNamingConfig;
	/**
	 * Mapeamento manual de relações para esta datasource.
	 * Usado como primeira camada antes do adapter e inferência automática.
	 */
	relationsMapping?: Record<string, ManualRelationMapping>;
	/**
	 * Habilita inferência automática de relações por convenção de nomes.
	 * Padrão: true para IXC, false para NocoBase (que já tem relações via API).
	 * @default true
	 */
	inferRelationsByName?: boolean;
}

export type DataSourceGenerationConfig = BaseDataSourceGenerationConfig;
