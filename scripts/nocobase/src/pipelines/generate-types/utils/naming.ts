import type { BaseInterfaceNamingConfig } from "@generators/pipelines/generate-types/@types/script";

const VALID_IDENTIFIER = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

/**
 * Remove apenas acentos de uma string, mantendo espaços e outros caracteres.
 * Usado para gerar nomes de enums válidos em TypeScript.
 */
export function removeAccents(str: string): string {
	return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Nome usado quando uma collection chega sem identificador válido.
 * Usa um sentinel improvável de colidir com nomes reais.
 */
const UNNAMED_COLLECTION_TYPE_NAME = "__UnnamedCollection__";

const DEFAULT_BASE_INTERFACE_NAMING: BaseInterfaceNamingConfig = {
	prefix: "",
	suffix: "",
};

export function resolveBaseInterfaceNamingConfig(
	baseInterfaceNaming?: Partial<BaseInterfaceNamingConfig>,
): BaseInterfaceNamingConfig {
	return {
		prefix: baseInterfaceNaming?.prefix ?? DEFAULT_BASE_INTERFACE_NAMING.prefix,
		suffix: baseInterfaceNaming?.suffix ?? DEFAULT_BASE_INTERFACE_NAMING.suffix,
	};
}

function formatBaseInterfaceName(
	typeName: string,
	baseInterfaceNaming?: Partial<BaseInterfaceNamingConfig>,
): string {
	const naming = resolveBaseInterfaceNamingConfig(baseInterfaceNaming);
	return `${naming.prefix}${typeName}${naming.suffix}`;
}

/**
 * Converte nome para PascalCase.
 * Remove prefixo "t_" se presente.
 *
 * @param name - Nome a ser convertido
 * @returns Nome em PascalCase
 *
 * @example
 * ```typescript
 * toPascalCase("t_negociacoes")    // "Negociacoes"
 * toPascalCase("user_roles")       // "UserRoles"
 * toPascalCase("departments")      // "Departments"
 * ```
 */
function toPascalCase(name: string): string {
	const withoutPrefix = name.startsWith("t_") ? name.slice(2) : name;
	return withoutPrefix
		.split(/[^a-zA-Z0-9]+/)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join("");
}

/**
 * Converte nome para identificador TypeScript válido.
 * Substitui caracteres inválidos por underscore.
 *
 * @param name - Nome a ser convertido
 * @returns Identificador válido
 *
 * @example
 * ```typescript
 * toValidIdentifier("my-var")      // "my_var"
 * toValidIdentifier("123abc")      // "_123abc"
 * toValidIdentifier("user@email")  // "user_email"
 * ```
 */
export function toValidIdentifier(name: string): string {
	const normalized = name.replace(/[^a-zA-Z0-9_$]/g, "_");
	if (!normalized) {
		return "_";
	}

	return /^\d/.test(normalized) ? `_${normalized}` : normalized;
}

/**
 * Formata chave de objeto TypeScript.
 * Adiciona aspas se não for identificador válido.
 *
 * @param name - Nome da chave
 * @returns Chave formatada (com ou sem aspas)
 *
 * @example
 * ```typescript
 * formatKey("userId")        // "userId"
 * formatKey("user-id")       // "\"user-id\""
 * formatKey("123")           // "\"123\""
 * ```
 */
export function formatKey(name: string): string {
	return VALID_IDENTIFIER.test(name) ? name : `"${name}"`;
}

/**
 * Converte nome de collection para nome de tipo TypeScript.
 * Aplica PascalCase e normalização.
 *
 * @param collectionName - Nome da collection
 * @returns Nome do tipo TypeScript
 *
 * @example
 * ```typescript
 * toCollectionTypeName("users")             // "Users"
 * toCollectionTypeName("t_negociacoes")     // "Negociacoes"
 * toCollectionTypeName("user-roles")        // "UserRoles"
 * ```
 */
export function toCollectionTypeName(collectionName: string): string {
	return toValidIdentifier(toPascalCase(collectionName));
}

/**
 * Converte texto livre para SCREAMING_SNAKE_CASE.
 */
export function toScreamingSnakeCase(value: string): string {
	const withoutAccents = removeAccents(value.trim());
	const normalized = withoutAccents
		.replace(/([a-z0-9])([A-Z])/g, "$1_$2")
		.replace(/[^a-zA-Z0-9]+/g, "_")
		.replace(/_+/g, "_")
		.replace(/^_+|_+$/g, "")
		.toUpperCase();

	return normalized || "UNKNOWN";
}

/**
 * Prefixo padrão para constantes derivadas do nome da collection.
 * Remove prefixos técnicos (`t_`/`f_`) e converte para SCREAMING_SNAKE_CASE.
 */
export function toCollectionConstantPrefix(collectionName: string): string {
	const withoutPrefix = collectionName.trim().replace(/^[tf]_/, "");
	return toValidIdentifier(toScreamingSnakeCase(withoutPrefix));
}

/**
 * Converte nome de collection para nome de tipo Base.
 * Aplica prefixo/sufixo configuráveis ao nome do tipo.
 *
 * @param collectionName - Nome da collection
 * @returns Nome do tipo Base (ex: Users)
 *
 * @example
 * ```typescript
 * toCollectionBaseTypeName("users")         // "Users"
 * toCollectionBaseTypeName("t_negociacoes") // "Negociacoes"
 * toCollectionBaseTypeName("users", { prefix: "I" }) // "IUsers"
 * toCollectionBaseTypeName("t_negociacoes", { suffix: "Base" }) // "NegociacoesBase"
 * toCollectionBaseTypeName("")              // "__UnnamedCollection__"
 * ```
 */
export function toCollectionBaseTypeName(
	collectionName: string,
	baseInterfaceNaming?: Partial<BaseInterfaceNamingConfig>,
): string {
	const normalizedName = collectionName.trim();
	if (!normalizedName) {
		return UNNAMED_COLLECTION_TYPE_NAME;
	}

	return formatBaseInterfaceName(
		toCollectionTypeName(normalizedName),
		baseInterfaceNaming,
	);
}

/**
 * Gera o nome do identificador da const do schema base de uma collection
 * (ex: `usersBaseSchema`, `linhas_fixasBaseSchema`).
 *
 * Strip do prefixo técnico (`t_`/`f_`) e normalização para identificador TS
 * **válido** via `toValidIdentifier` — hífens/espaços viram `_`. Por isso aceita
 * tanto o nome real da API (`t_linhas_fixas`) quanto o slug da pasta
 * (`linhas-fixas`); ambos produzem `linhas_fixasBaseSchema`.
 *
 * @param collectionName - Nome da collection (nome real da API ou slug)
 * @returns Identificador TS válido
 *
 * @example
 * ```typescript
 * toBaseSchemaName("users")             // "usersBaseSchema"
 * toBaseSchemaName("t_linhas_fixas")    // "linhas_fixasBaseSchema"
 * toBaseSchemaName("linhas-fixas")      // "linhas_fixasBaseSchema"
 * toBaseSchemaName("t_users")           // "usersBaseSchema"
 * ```
 */
export function toBaseSchemaName(collectionName: string): string {
	// Strip só do prefixo de TABELA (`t_`), não de campo (`f_`). Collections NocoBase
	// usam `t_`; IXC não usa prefixo. Tirar `f_` aqui colapsaria collections distintas
	// (ex.: `f_shared` → `sharedBaseSchema` == `t_shared` → `sharedBaseSchema`),
	// quebrando o agrupamento de imports e a deduplicação de schemas.
	const cleanCollectionName = collectionName.replace(/^t_/, "").toLowerCase();
	const baseName =
		!cleanCollectionName || cleanCollectionName === "t"
			? `${collectionName.toLowerCase()}BaseSchema`
			: `${cleanCollectionName}BaseSchema`;
	return toValidIdentifier(baseName);
}

/**
 * Converte nome de collection para nome de arquivo kebab-case.
 * Remove prefixo "t_" ou "f_" se presente.
 *
 * @param collectionName - Nome da collection
 * @returns Nome de arquivo em kebab-case
 *
 * @example
 * ```typescript
 * toFileName("t_negociacoes")    // "negociacoes"
 * toFileName("f_funcionarios")   // "funcionarios"
 * toFileName("user_roles")       // "user-roles"
 * toFileName("users")            // "users"
 * ```
 */
export function toFileName(collectionName: string): string {
	const withoutPrefix = collectionName.replace(/^[tf]_/, "");
	return withoutPrefix
		.split(/[^a-zA-Z0-9]+/)
		.filter(Boolean)
		.map((part) => part.toLowerCase())
		.join("-");
}
