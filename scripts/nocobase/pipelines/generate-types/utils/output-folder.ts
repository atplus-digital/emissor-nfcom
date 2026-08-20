function toSafePathSegment(value: string): string {
	return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

/**
 * Pasta de saída para um datasource. O datasource `main` é histórico e
 * produz em `nocobase/`; os demais usam a própria key normalizada.
 */
export function toDataSourceOutputFolder(dataSourceKey: string): string {
	return dataSourceKey === "main"
		? "nocobase"
		: toSafePathSegment(dataSourceKey);
}
