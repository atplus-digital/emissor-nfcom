export function toSafePathSegment(value: string): string {
	return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

export function toDataSourceOutputFolder(dataSourceKey: string): string {
	return dataSourceKey === "main"
		? "nocobase"
		: toSafePathSegment(dataSourceKey);
}
