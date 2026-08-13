import type { DataSourceGenerationConfig } from "../src/pipelines/generate-types/@types/script-config";

export const dataSourceConfigs: DataSourceGenerationConfig[] = [
	{
		name: "nocobase",
		type: "nocobase",
		dataSource: "main",
		// includeAllCollections: true,
		includeDependents: true,
		inferRelationsByName: false,
		splitCollections: ["users"],
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
