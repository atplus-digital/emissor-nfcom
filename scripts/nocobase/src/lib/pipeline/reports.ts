type ReportJsonPrimitive = string | number | boolean | null;

type ReportJsonValue =
	| ReportJsonPrimitive
	| ReportJsonObject
	| ReportJsonValue[];

interface ReportJsonObject {
	[key: string]: ReportJsonValue;
}

interface ReportEntryScope {
	pipeline: string;
	stage: string;
	dataSourceKey?: string;
}

interface JsonReportEntry {
	entryId: string;
	key: string;
	title: string;
	scope: ReportEntryScope;
	createdAt: string;
	payload: ReportJsonObject;
}

interface JsonReportNamespace {
	name: string;
	entries: JsonReportEntry[];
}

export interface PipelineReportsContext {
	schemaVersion: 1;
	namespaces: Record<string, JsonReportNamespace>;
}

interface AddJsonReportInput {
	namespace: string;
	key: string;
	title: string;
	payload: ReportJsonObject;
	scope: ReportEntryScope;
}

export function createReportsContext(): PipelineReportsContext {
	return {
		schemaVersion: 1,
		namespaces: {},
	};
}

function sanitizeIdentifier(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replaceAll(/[^a-z0-9_-]+/g, "-")
		.replaceAll(/-+/g, "-")
		.replaceAll(/^-|-$/g, "");
}

function resolveEntryId(
	existingEntries: JsonReportEntry[],
	key: string,
): string {
	const base = sanitizeIdentifier(key) || "report";
	let suffix = 0;
	let candidate = base;

	const existingIds = new Set(existingEntries.map((entry) => entry.entryId));
	while (existingIds.has(candidate)) {
		suffix += 1;
		candidate = `${base}-${suffix}`;
	}

	return candidate;
}

export function addJsonReport(
	context: PipelineReportsContext,
	input: AddJsonReportInput,
	now: Date = new Date(),
): PipelineReportsContext {
	const namespaceKey = sanitizeIdentifier(input.namespace) || "general";
	const currentNamespace = context.namespaces[namespaceKey] ?? {
		name: input.namespace.trim() || "general",
		entries: [],
	};

	const entryId = resolveEntryId(currentNamespace.entries, input.key);
	const entry: JsonReportEntry = {
		entryId,
		key: input.key,
		title: input.title,
		scope: input.scope,
		createdAt: now.toISOString(),
		payload: input.payload,
	};

	context.namespaces[namespaceKey] = {
		...currentNamespace,
		entries: [...currentNamespace.entries, entry],
	};

	return context;
}

export function countReports(context: PipelineReportsContext): number {
	return Object.values(context.namespaces).reduce(
		(total, namespace) => total + namespace.entries.length,
		0,
	);
}

export function renderReportsMarkdown(
	context: PipelineReportsContext,
	options: { title?: string; generatedAt?: Date } = {},
): string {
	const title = options.title ?? "Relatório Consolidado";
	const generatedAt = (options.generatedAt ?? new Date()).toISOString();
	const namespaces = Object.entries(context.namespaces).sort(([a], [b]) =>
		a.localeCompare(b),
	);

	const lines: string[] = [
		`# ${title}`,
		"",
		`Gerado em: \`${generatedAt}\``,
		"",
		`Total de reports: **${countReports(context)}**`,
		"",
		"## Sumário",
		"",
		"| Namespace | Quantidade |",
		"| --- | --- |",
	];

	if (namespaces.length === 0) {
		lines.push("| _nenhum_ | 0 |", "");
	} else {
		for (const [namespaceKey, namespace] of namespaces) {
			lines.push(
				`| \`${namespace.name || namespaceKey}\` | ${namespace.entries.length} |`,
			);
		}
		lines.push("");
	}

	for (const [, namespace] of namespaces) {
		lines.push(`## ${namespace.name}`, "");

		if (namespace.name === "generate-types") {
			const collectionEntries = namespace.entries.filter(
				(entry) => typeof entry.payload.collectionName === "string",
			);
			const otherEntries = namespace.entries.filter(
				(entry) => typeof entry.payload.collectionName !== "string",
			);

			for (const entry of otherEntries) {
				lines.push(`### ${entry.title}`, "");
				lines.push(`- id: \`${entry.entryId}\``);
				lines.push(`- key: \`${entry.key}\``);
				lines.push(`- pipeline: \`${entry.scope.pipeline}\``);
				lines.push(`- stage: \`${entry.scope.stage}\``);
				if (entry.scope.dataSourceKey) {
					lines.push(`- datasource: \`${entry.scope.dataSourceKey}\``);
				}
				lines.push(`- criado em: \`${entry.createdAt}\``, "");
				lines.push(
					"```json",
					JSON.stringify(entry.payload, null, 2),
					"```",
					"",
				);
			}

			if (collectionEntries.length > 0) {
				const grouped = new Map<string, JsonReportEntry[]>();
				for (const entry of collectionEntries) {
					const collectionName = entry.payload.collectionName as string;
					const existing = grouped.get(collectionName);
					if (existing) {
						existing.push(entry);
					} else {
						grouped.set(collectionName, [entry]);
					}
				}

				for (const [collectionName, entries] of [...grouped.entries()].sort(
					([a], [b]) => a.localeCompare(b),
				)) {
					lines.push(`## ${collectionName}`, "");
					for (const entry of entries) {
						lines.push(`### ${entry.title}`, "");
						lines.push(`- id: \`${entry.entryId}\``);
						lines.push(`- key: \`${entry.key}\``);
						lines.push(`- pipeline: \`${entry.scope.pipeline}\``);
						lines.push(`- stage: \`${entry.scope.stage}\``);
						if (entry.scope.dataSourceKey) {
							lines.push(`- datasource: \`${entry.scope.dataSourceKey}\``);
						}
						lines.push(`- criado em: \`${entry.createdAt}\``, "");
						lines.push(
							"```json",
							JSON.stringify(entry.payload, null, 2),
							"```",
							"",
						);
					}
				}
			}
			continue;
		}

		for (const entry of namespace.entries) {
			lines.push(`### ${entry.title}`, "");
			lines.push(`- id: \`${entry.entryId}\``);
			lines.push(`- key: \`${entry.key}\``);
			lines.push(`- pipeline: \`${entry.scope.pipeline}\``);
			lines.push(`- stage: \`${entry.scope.stage}\``);
			if (entry.scope.dataSourceKey) {
				lines.push(`- datasource: \`${entry.scope.dataSourceKey}\``);
			}
			lines.push(`- criado em: \`${entry.createdAt}\``, "");
			lines.push("```json", JSON.stringify(entry.payload, null, 2), "```", "");
		}
	}

	return lines.join("\n");
}
