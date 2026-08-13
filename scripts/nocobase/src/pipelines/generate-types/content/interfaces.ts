import type {
	GeneratedTypes,
	RelationInfo,
} from "@generators/pipelines/generate-types/@types/generation";
import type { BaseInterfaceNamingConfig } from "@generators/pipelines/generate-types/@types/script";
import {
	formatKey,
	toCollectionBaseTypeName,
	toCollectionTypeName,
} from "@generators/pipelines/generate-types/utils/naming";
import { getScalarFieldType, getScalarFieldZodType } from "./enums";
import {
	getRelationCardinality,
	renderRelationValueType,
	renderRelationZodType,
} from "./relations";
import { _sortMapEntries, _sortScalarEntries } from "./sorting";

interface CollectionInterfacesOutput {
	baseInterface: string;
	relationsInterface: string;
	relationKeyType: string;
	/** Nome do schema principal (merge, ex: usersSchema) */
	schemaName: string;
	/** Nome do type principal (ex: Users) */
	typeName: string;
	/** Nome do schema base (ex: usersBaseSchema) */
	baseSchemaName: string;
	/** Nome do schema de relação (ex: usersRelationSchema) */
	relationSchemaName: string;
	/** Nome do schema de criação (ex: usersCreateSchema) */
	createSchemaName: string;
	/** Nome do schema de atualização (ex: usersUpdateSchema) */
	updateSchemaName: string;
}

function _renderRelationFieldType(
	relation: RelationInfo,
	baseInterfaceNaming?: Partial<BaseInterfaceNamingConfig>,
): string {
	return renderRelationValueType(
		relation.targetCollection,
		getRelationCardinality(relation.type),
		baseInterfaceNaming,
	);
}

// ============================================================
// Schema name helpers
// ============================================================

/**
 * Prefixa um nome se começar com número para garantir identificador válido.
 */
function ensureValidIdentifier(name: string): string {
	if (/^[0-9]/.test(name)) {
		return `_${name}`;
	}
	return name;
}

/**
 * Gera o nome do schema base para uma collection (ex: usersBaseSchema).
 */
function toBaseSchemaName(collectionName: string): string {
	const cleanCollectionName = collectionName.replace(/^t_/, "").toLowerCase();
	if (!cleanCollectionName || cleanCollectionName === "t") {
		return ensureValidIdentifier(`${collectionName.toLowerCase()}BaseSchema`);
	}
	return ensureValidIdentifier(`${cleanCollectionName}BaseSchema`);
}

/**
 * Gera o nome do schema de relação (ex: usersRelationSchema).
 */
function _toRelationSchemaName(collectionName: string): string {
	const cleanCollectionName = collectionName.replace(/^t_/, "").toLowerCase();
	if (!cleanCollectionName || cleanCollectionName === "t") {
		return ensureValidIdentifier(
			`${collectionName.toLowerCase()}RelationSchema`,
		);
	}
	return ensureValidIdentifier(`${cleanCollectionName}RelationSchema`);
}

/**
 * Gera o nome do schema principal (merge, ex: usersSchema).
 */
function _toMainSchemaName(collectionName: string): string {
	const cleanCollectionName = collectionName.replace(/^t_/, "").toLowerCase();
	if (!cleanCollectionName || cleanCollectionName === "t") {
		return ensureValidIdentifier(`${collectionName.toLowerCase()}Schema`);
	}
	return ensureValidIdentifier(`${cleanCollectionName}Schema`);
}

/**
 * Gera o nome do schema de criação (ex: usersCreateSchema).
 */
function _toCreateSchemaName(collectionName: string): string {
	const cleanCollectionName = collectionName.replace(/^t_/, "").toLowerCase();
	if (!cleanCollectionName || cleanCollectionName === "t") {
		return ensureValidIdentifier(`${collectionName.toLowerCase()}CreateSchema`);
	}
	return ensureValidIdentifier(`${cleanCollectionName}CreateSchema`);
}

/**
 * Gera o nome do schema de atualização (ex: usersUpdateSchema).
 */
function _toUpdateSchemaName(collectionName: string): string {
	const cleanCollectionName = collectionName.replace(/^t_/, "").toLowerCase();
	if (!cleanCollectionName || cleanCollectionName === "t") {
		return ensureValidIdentifier(`${collectionName.toLowerCase()}UpdateSchema`);
	}
	return ensureValidIdentifier(`${cleanCollectionName}UpdateSchema`);
}

// ============================================================
// Interface generation (non-split / manual)
// ============================================================

/**
 * Gera a interface Base de uma collection (apenas campos escalares/FKs).
 */
function generateCollectionBaseInterface(
	collectionName: string,
	types: GeneratedTypes,
	baseInterfaceNaming?: Partial<BaseInterfaceNamingConfig>,
): string {
	const lines: string[] = [];
	const scalarEntries = _sortScalarEntries(types.scalars);
	const typeName = toCollectionBaseTypeName(
		collectionName,
		baseInterfaceNaming,
	);

	lines.push(`export interface ${typeName} {`);
	for (const [fieldName, fieldType] of scalarEntries) {
		const resolvedType = getScalarFieldType(
			fieldName,
			fieldType,
			types,
			collectionName,
		);
		lines.push(`\t${formatKey(fieldName)}: ${resolvedType};`);
	}
	lines.push("}");

	return lines.join("\n");
}

/**
 * Gera a interface Relations de uma collection (manual, para non-split).
 */
function generateCollectionRelationsInterface(
	collectionName: string,
	types: GeneratedTypes,
	baseInterfaceNaming?: Partial<BaseInterfaceNamingConfig>,
): string {
	const lines: string[] = [];
	const relationEntries = _sortMapEntries(types.relations);
	const typeName = toCollectionTypeName(collectionName);

	if (relationEntries.length === 0) {
		lines.push(`export type ${typeName}Relations = Record<string, never>;`);
	} else {
		lines.push(`export type ${typeName}Relations = {`);
		for (const [fieldName, relation] of relationEntries) {
			lines.push(
				`\t${formatKey(fieldName)}?: ${_renderRelationFieldType(relation, baseInterfaceNaming)};`,
			);
		}
		lines.push("};");
	}

	return lines.join("\n");
}

/**
 * Gera o tipo RelationKey de uma collection.
 */
function generateCollectionRelationKeyType(collectionName: string): string {
	const typeName = toCollectionTypeName(collectionName);
	const relationKeyLine = `export type ${typeName}RelationKey = keyof ${typeName}Relations;`;

	if (relationKeyLine.length <= 80) {
		return relationKeyLine;
	}

	const lines: string[] = [];
	lines.push(`export type ${typeName}RelationKey =`);
	lines.push(`\tkeyof ${typeName}Relations;`);
	return lines.join("\n");
}

// ============================================================
// Zod schema generation (split collections)
// ============================================================

/**
 * Gera o schema Zod BASE da collection (campos escalares).
 * Ex: export const usersBaseSchema = z.object({ id: z.number(), ... });
 */
export function generateBaseSchema(
	collectionName: string,
	types: GeneratedTypes,
): string | null {
	const scalarEntries = _sortScalarEntries(types.scalars);
	const schemaName = toBaseSchemaName(collectionName);
	const lines: string[] = [];
	lines.push(`export const ${schemaName} = z.object({`);

	for (const [fieldName, fieldType] of scalarEntries) {
		const resolvedType = getScalarFieldZodType(
			fieldName,
			fieldType,
			types,
			collectionName,
		);
		lines.push(`\t${formatKey(fieldName)}: ${resolvedType},`);
	}

	lines.push("});");

	return lines.join("\n");
}

/**
 * Gera o schema Zod de RELAÇÃO da collection.
 * Usa referências a schemas base quando disponíveis.
 *
 * @returns Objeto com o conteúdo do schema e nomes de tipos externos para import-injector
 */
export function generateRelationSchema(
	collectionName: string,
	types: GeneratedTypes,
	availableCollections: ReadonlySet<string>,
	baseInterfaceNaming?: Partial<BaseInterfaceNamingConfig>,
): { content: string | null; externalTypeNames: string[] } {
	const relationEntries = _sortMapEntries(types.relations);

	if (relationEntries.length === 0) {
		return { content: null, externalTypeNames: [] };
	}

	const schemaName = _toRelationSchemaName(collectionName);
	const externalTypeNames: string[] = [];

	const lines: string[] = [];
	lines.push(`export const ${schemaName} = z.object({`);

	for (const [fieldName, relation] of relationEntries) {
		const cardinality = getRelationCardinality(relation.type);
		const zodType = renderRelationZodType(
			relation.targetCollection,
			cardinality,
			availableCollections,
		);

		// Rastreia tipos externos para o import-injector
		const targetCollectionTrimmed = relation.targetCollection.trim();
		if (
			targetCollectionTrimmed &&
			availableCollections.has(targetCollectionTrimmed) &&
			targetCollectionTrimmed !== collectionName
		) {
			const targetTypeName = toCollectionBaseTypeName(
				targetCollectionTrimmed,
				baseInterfaceNaming,
			);
			if (!externalTypeNames.includes(targetTypeName)) {
				externalTypeNames.push(targetTypeName);
			}
		}

		lines.push(`\t${formatKey(fieldName)}: ${zodType},`);
	}

	lines.push("});");

	return { content: lines.join("\n"), externalTypeNames };
}

/**
 * Gera o schema Zod PRINCIPAL (merge de base + relation).
 * Ex: export const usersSchema = usersBaseSchema.merge(usersRelationSchema);
 */
export function generateMergedMainSchema(
	collectionName: string,
	types: GeneratedTypes,
): string | null {
	const baseSchema = toBaseSchemaName(collectionName);
	const mainSchemaName = _toMainSchemaName(collectionName);
	const hasRelations = types.relations.size > 0;
	const hasScalars = types.scalars.size > 0;

	if (!hasScalars && !hasRelations) {
		return null;
	}

	if (hasRelations) {
		const relationSchemaName = _toRelationSchemaName(collectionName);
		return `export const ${mainSchemaName} = ${baseSchema}.extend(\n\t${relationSchemaName}.shape,\n);`;
	}

	// Sem relações: o schema principal é apenas o base
	return `export const ${mainSchemaName} = ${baseSchema};`;
}

/**
 * Determina quais campos devem ser omitidos do createSchema.
 *
 * Campos omitidos:
 * - id: chave primária, gerada pelo banco
 * - createdAt/updatedAt: timestamps gerenciados pelo NocoBase (se existirem)
 * - createdById/updatedById: referências de auditoria do NocoBase (se existirem)
 * - Todos os campos de relação: não devem ser definidos na criação
 *
 * IMPORTANTE: Só omite campos que existem na collection (validação explícita).
 */
function _getCreateSchemaOmitFields(types: GeneratedTypes): string[] {
	const omitFields: string[] = [];

	// Campos escalares auto-gerados a omitir
	// Verifica presença explícita antes de omitir
	const autoGeneratedScalars = ["id", "createdAt", "updatedAt"];

	// Adiciona campos de auditoria apenas quando existirem na collection
	if (types.scalars.has("createdById")) {
		autoGeneratedScalars.push("createdById");
	}
	if (types.scalars.has("updatedById")) {
		autoGeneratedScalars.push("updatedById");
	}

	for (const pattern of autoGeneratedScalars) {
		if (types.scalars.has(pattern)) {
			omitFields.push(pattern);
		}
	}

	// All relation fields are omitted from create
	for (const [fieldName] of types.relations) {
		omitFields.push(fieldName);
	}

	return omitFields.sort((a, b) => a.localeCompare(b));
}

/**
 * Gera o schema Zod de CRIAÇÃO (omit de campos auto-gerados e relações).
 * Ex: export const usersCreateSchema = usersSchema.omit({ id: true, ... });
 */
export function generateCreateSchema(
	collectionName: string,
	types: GeneratedTypes,
): string | null {
	const mainSchemaName = _toMainSchemaName(collectionName);
	const createSchemaName = _toCreateSchemaName(collectionName);
	const hasScalars = types.scalars.size > 0;
	const hasRelations = types.relations.size > 0;

	if (!hasScalars && !hasRelations) {
		return null;
	}

	const omitFields = _getCreateSchemaOmitFields(types);

	if (omitFields.length === 0) {
		return `export const ${createSchemaName} = ${mainSchemaName};`;
	}

	const omitEntries = omitFields
		.map((field) => `\t${formatKey(field)}: true,`)
		.join("\n");

	return `export const ${createSchemaName} = ${mainSchemaName}.omit({\n${omitEntries}\n});`;
}

/**
 * Gera o schema Zod de ATUALIZAÇÃO (partial do createSchema).
 * Ex: export const usersUpdateSchema = usersCreateSchema.partial();
 */
export function generateUpdateSchema(
	collectionName: string,
	types: GeneratedTypes,
): string | null {
	const createSchemaName = _toCreateSchemaName(collectionName);
	const updateSchemaName = _toUpdateSchemaName(collectionName);
	const hasScalars = types.scalars.size > 0;
	const hasRelations = types.relations.size > 0;

	if (!hasScalars && !hasRelations) {
		return null;
	}

	return `export const ${updateSchemaName} = ${createSchemaName}.partial();`;
}

/**
 * Gera a type Relations usando z.infer do relationSchema.
 * Ex: export type UsersRelations = z.infer<typeof usersRelationSchema>;
 */
function generateCollectionRelationsInferred(
	collectionName: string,
	types: GeneratedTypes,
): string {
	const typeName = toCollectionTypeName(collectionName);
	const relationSchemaName = _toRelationSchemaName(collectionName);

	if (types.relations.size === 0) {
		return `export type ${typeName}Relations = Record<string, never>;`;
	}

	return `export type ${typeName}Relations = z.infer<typeof import("./schemas").${relationSchemaName}>;`;
}

// ============================================================
// ============================================================

// ============================================================
// Orchestrator
// ============================================================

/**
 * Orquestra a geração completa dos contratos de interface de uma collection.
 * Mantém a ordem de saída usada pelo pipeline de conteúdo.
 */
export function generateCollectionInterfaces(
	collectionName: string,
	types: GeneratedTypes,
	baseInterfaceNaming?: Partial<BaseInterfaceNamingConfig>,
	isSplitCollection = false,
): CollectionInterfacesOutput {
	const baseSchema = toBaseSchemaName(collectionName);
	const relationSchemaName = _toRelationSchemaName(collectionName);
	const mainSchemaName = _toMainSchemaName(collectionName);
	const createSchemaName = _toCreateSchemaName(collectionName);
	const updateSchemaName = _toUpdateSchemaName(collectionName);
	const typeName = toCollectionBaseTypeName(
		collectionName,
		baseInterfaceNaming,
	);

	// Para split collections, não gera interface (usa type inferido do schema)
	let baseInterface = "";
	if (!isSplitCollection) {
		baseInterface = generateCollectionBaseInterface(
			collectionName,
			types,
			baseInterfaceNaming,
		);
	}

	// Para split collections, usa z.infer; para non-split, usa type manual
	const relationsInterface = isSplitCollection
		? generateCollectionRelationsInferred(collectionName, types)
		: generateCollectionRelationsInterface(
				collectionName,
				types,
				baseInterfaceNaming,
			);

	return {
		baseInterface,
		relationsInterface,
		relationKeyType: generateCollectionRelationKeyType(collectionName),
		schemaName: mainSchemaName,
		typeName,
		baseSchemaName: baseSchema,
		relationSchemaName,
		createSchemaName,
		updateSchemaName,
	};
}
