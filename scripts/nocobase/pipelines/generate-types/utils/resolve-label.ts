import type {
	DataSourceCollection,
	DataSourceField,
} from "../@types/script-data-source";

const I18N_TEMPLATE_KEY_REGEX = /^\s*\{\{\s*t\(\s*["']([^"']+)["']/;

const I18N_PT_LABEL_OVERRIDES: Record<string, string> = {
	Children: "Filhos",
	"Created at": "Criado em",
	"Created by": "Criado por",
	Departments: "Departamentos",
	Email: "E-mail",
	"Extension name": "Nome da extensão",
	"File name": "Nome do arquivo",
	ID: "ID",
	"Main department": "Departamento principal",
	"MIME type": "Tipo MIME",
	"Role UID": "UID da função",
	Nickname: "Apelido",
	Owners: "Proprietários",
	Parent: "Pai",
	"Superior department": "Departamento superior",
	"Parent ID": "ID do pai",
	Password: "Senha",
	Path: "Caminho",
	Phone: "Telefone",
	Preview: "Pré-visualização",
	Roles: "Funções",
	Size: "Tamanho",
	Storage: "Armazenamento",
	"Department name": "Nome do departamento",
	"Role name": "Nome da função",
	Title: "Título",
	"Last updated at": "Última atualização em",
	"Last updated by": "Última atualização por",
	URL: "URL",
	Username: "Usuário",
};

function extractI18nTemplateKey(rawLabel: string): string | null {
	const match = rawLabel.match(I18N_TEMPLATE_KEY_REGEX);
	if (!match) {
		return null;
	}
	return match[1]?.trim() || null;
}

/**
 * Título humano da collection a partir do payload NocoBase (`collection.title`).
 * Chave i18n sem tradução cai no nome técnico da collection.
 */
export function resolveCollectionLabel(
	collectionName: string,
	apiCollection?: Pick<DataSourceCollection, "title">,
): string {
	const rawTitle = apiCollection?.title?.trim();
	if (!rawTitle) {
		return collectionName;
	}

	const i18nTemplateKey = extractI18nTemplateKey(rawTitle);
	if (i18nTemplateKey) {
		return I18N_PT_LABEL_OVERRIDES[i18nTemplateKey] ?? collectionName;
	}

	return rawTitle;
}

/**
 * Rótulo humano do field a partir de `field.uiSchema.title`.
 * Chave i18n sem tradução mantém o rótulo original (raw).
 */
export function resolveFieldLabel(
	field: Pick<DataSourceField, "name" | "uiSchema">,
): string {
	const rawLabel = field.uiSchema?.title?.trim();
	if (!rawLabel) {
		return field.name;
	}

	const i18nTemplateKey = extractI18nTemplateKey(rawLabel);
	if (i18nTemplateKey) {
		return I18N_PT_LABEL_OVERRIDES[i18nTemplateKey] ?? rawLabel;
	}

	return rawLabel;
}
