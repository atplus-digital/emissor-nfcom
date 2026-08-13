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

/**
 * Configuração para inferência de enums aplicada globalmente ou por datasource.
 */
interface EnumInferenceConfig {
	/**
	 * Threshold de cardinalidade para considerar um campo como enum.
	 * Campos com cardinalidade menor que este valor são candidatos a enum.
	 * @default 5
	 */
	cardinalityThreshold?: number;

	/**
	 * Tamanho da amostra para calcular cardinalidade.
	 * @default 5000
	 */
	sampleSize?: number;

	/**
	 * Razão mínima de repetição para considerar como enum.
	 * Ex: 0.8 significa que 80% dos registros devem ter valores repetidos.
	 * @default 0.8
	 */
	minRepetitionRatio?: number;

	/**
	 * Lista negra de padrões de nomes de campos que nunca serão enums.
	 * @default []
	 */
	fieldNameBlacklist?: string[];

	/**
	 * Lista negra de padrões de valores que nunca serão enums.
	 * @default []
	 */
	valueBlacklist?: string[];

	/**
	 * Variação máxima entre valores numéricos para considerar como enum.
	 * Ex: valores [1, 5, 10, 100] têm variação 99 — se threshold=50, não é enum.
	 * @default 50
	 */
	maxNumericVariation?: number;

	/**
	 * Valor mínimo para considerar como enum (valores > min não são enums).
	 * Ex: [1898, 2896] — min=1898 > 50 → não é enum.
	 * @default 50
	 */
	minNumericValue?: number;

	/**
	 * Padrões de campos que são conhecidos por serem enums (ignora outras regras).
	 * Ex: ['/_id$/', '/^tipo_/'] — campos com estes padrões sempre são candidatos.
	 * @default []
	 */
	fieldNamePatterns?: string[];

	/**
	 * Threshold aumentado para campos que correspondem a fieldNamePatterns.
	 * @default 500
	 */
	patternThreshold?: number;
}

interface BaseDataSourceGenerationConfig {
	name: string;
	type: "nocobase" | "rest";
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
	enumInference?: EnumInferenceConfig;
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
