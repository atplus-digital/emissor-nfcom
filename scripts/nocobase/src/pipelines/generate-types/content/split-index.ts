import type { BaseInterfaceNamingConfig } from "@generators/pipelines/generate-types/@types/script";
import {
	toCollectionBaseTypeName,
	toCollectionTypeName,
	toFileName,
} from "@generators/pipelines/generate-types/utils/naming";
import { generateFileHeader } from "./content";

/**
 * Gera index.ts com re-exports de TODAS as collections usando paths customizados.
 * Útil quando collections estão em subpastas (ex: other/).
 *
 * @param allCollectionNames - Nomes de todas as collections
 * @param collectionPaths - Map de collectionName → import path relativo
 * @param baseInterfaceNaming - Configuração de nomenclatura
 */
export function generateIndexWithAllExportsWithPaths(
	allCollectionNames: readonly string[],
	collectionPaths: Map<string, string>,
	baseInterfaceNaming: BaseInterfaceNamingConfig,
): string {
	const header = generateFileHeader();

	if (allCollectionNames.length === 0) {
		return header;
	}

	const exports: string[] = [];

	for (const collectionName of allCollectionNames) {
		const baseTypeName = toCollectionBaseTypeName(
			collectionName,
			baseInterfaceNaming,
		);
		const typeName = toCollectionTypeName(collectionName);
		const importPath =
			collectionPaths.get(collectionName) ?? `./${toFileName(collectionName)}`;

		exports.push(
			`export type { ${baseTypeName}, ${typeName}Relations, ${typeName}RelationKey } from "${importPath}";`,
		);
	}

	return `${[header, ...exports.sort()].join("\n")}\n`;
}
