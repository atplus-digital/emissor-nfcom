import type { DataSourceCollection } from "../@types/script-data-source";

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
