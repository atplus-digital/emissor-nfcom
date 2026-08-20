export interface DataSourceCollection {
	name: string;
	title?: string;
	/** Fields returned by the API (collections:list returns fields embedded) */
	fields?: DataSourceField[];
}

export interface DataSourceField {
	name: string;
	type: string;
	interface?: string | null;
	target?: string | null;
	uiSchema?: {
		enum?: Array<{
			value: string | number;
			label: string;
		}>;
		title?: string;
	};
}
