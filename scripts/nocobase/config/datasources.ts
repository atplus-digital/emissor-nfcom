import type { DataSourceGenerationConfig } from "../src/pipelines/generate-types/@types/script-config";

export const dataSourceConfigs: DataSourceGenerationConfig[] = [
	{
		name: "nocobase",
		type: "nocobase",
		dataSource: "main",
		// includeAllCollections: true,
		includeDependents: true,
		inferRelationsByName: false,
		// Collections efetivamente consumidas pelo app (módulo `atacado` +
		// translators). Split = pasta própria em packages/generated/types/nocobase/,
		// em vez de caírem em other/. Mantém o barrel index.ts reexportando tudo.
		// ⚠️ Use o NOME REAL da collection na API NocoBase (com prefixo `t_` e
		// underscores), NÃO o slug kebab da pasta — o gerador deriva a pasta via
		// toFileName() e faz lookup por este nome no fetch de schemas. Slugs
		// (ex. "linhas-fixas") não casam com nada na API → schema vazio.
		// Exceção: `users` (nome real = slug, sem `t_`).
		splitCollections: [
			"users",
			"t_parceiros",
			"t_clientes",
			"t_planos_de_servico",
			"t_linhas_fixas",
			"t_nfcom_faturas",
			"t_nfcom_cobrancas",
			"t_nfcom_notas",
			"t_nfcom_itens",
			"t_nfcom_erros",
		],
	},
	{
		name: "ixc",
		type: "nocobase",
		dataSource: "d_db_ixcsoft",
		// includeAllCollections: true,
		includeDependents: true,
		splitCollections: ["cliente", "cliente_contrato"],
	},
];
