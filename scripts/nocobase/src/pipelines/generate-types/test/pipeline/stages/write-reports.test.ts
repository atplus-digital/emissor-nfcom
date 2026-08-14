import { writeReportsStage } from "@generators/pipelines/generate-types/stages/write-reports";
import { describe, expect, it } from "bun:test";
import { createMockGeneratedTypes } from "../../factories";
import { createMockTask, createPipelineContext } from "../../helpers";

function reportKeys(reports: {
	namespaces: Record<string, { entries: { key: string }[] }>;
}) {
	return Object.values(reports.namespaces).flatMap((ns) =>
		ns.entries.map((e) => e.key),
	);
}

describe("writeReportsStage", () => {
	it("adds JSON reports for collections, files, and split status", async () => {
		const users = createMockGeneratedTypes(
			{ id: "number" },
			{},
			{},
			{ id: "ID", email: '{{ t("Email") }}' },
		);

		const context = createPipelineContext({
			pipelineContext: {
				collectionTypes: { users },
				mainCollections: { users },
				splitCollections: new Map(),
				collections: [{ name: "users" }],
				fileContents: new Map([["index.ts", "export {}"]]),
				writeResults: [
					{ outputPath: "index.ts", changed: true },
					{ outputPath: "users/labels.ts", changed: false },
				],
				unresolvedRelations: [],
			},
		});

		const result = await writeReportsStage(context, createMockTask());
		const keys = reportKeys(result.reports);

		expect(keys).toContain("collections-processed-main");
		expect(keys).toContain("files-generated-main");
		expect(keys).toContain("unresolved-relations-main");
		expect(keys).toContain("split-status-main");
		expect(keys).toContain("i18n-title-template-fields-main");
		expect(keys).toContain("collection-content-main-users");
	});

	it("reports unresolved relations grouped by collection", async () => {
		const context = createPipelineContext({
			pipelineContext: {
				collectionTypes: {
					users: createMockGeneratedTypes({ id: "number" }),
				},
				unresolvedRelations: [
					{ collection: "users", field: "f_missing", target: "ghost" },
					{ collection: "users", field: "f_other", target: "phantom" },
				],
			},
		});

		const result = await writeReportsStage(context, createMockTask());
		const entry = Object.values(result.reports.namespaces)
			.flatMap((ns) => ns.entries)
			.find((e) => e.key === "unresolved-relations-main");

		expect(entry?.payload.totalUnresolved).toBe(2);
		expect(entry?.payload.relationsByCollection).toEqual({
			users: ["f_missing → ghost", "f_other → phantom"],
		});
	});

	it("deduplicates i18n template fields across collections", async () => {
		const sharedLabel = '{{ t("Title") }}';
		const context = createPipelineContext({
			pipelineContext: {
				collectionTypes: {
					users: createMockGeneratedTypes({}, {}, {}, { f_title: sharedLabel }),
					posts: createMockGeneratedTypes({}, {}, {}, { f_title: sharedLabel }),
				},
			},
		});

		const result = await writeReportsStage(context, createMockTask());
		const entry = Object.values(result.reports.namespaces)
			.flatMap((ns) => ns.entries)
			.find((e) => e.key === "i18n-title-template-fields-main");

		expect(entry?.payload.totalUniqueFields).toBe(1);
		expect(entry?.payload.fields[0].collections).toEqual(["posts", "users"]);
	});

	it("sorts i18n report entries by field name then label template", async () => {
		const context = createPipelineContext({
			pipelineContext: {
				collectionTypes: {
					users: createMockGeneratedTypes(
						{},
						{},
						{},
						{
							f_z: '{{ t("Zebra") }}',
							f_a: '{{ t("Alpha") }}',
						},
					),
				},
			},
		});

		const result = await writeReportsStage(context, createMockTask());
		const entry = Object.values(result.reports.namespaces)
			.flatMap((ns) => ns.entries)
			.find((e) => e.key === "i18n-title-template-fields-main");

		expect(
			entry?.payload.fields.map((f: { fieldName: string }) => f.fieldName),
		).toEqual(["f_a", "f_z"]);
	});

	it("throws when pipelineContext is missing", async () => {
		const context = createPipelineContext();
		// @ts-expect-error — simula contexto inválido
		context.pipelineContext = undefined;

		await expect(writeReportsStage(context, createMockTask())).rejects.toThrow(
			"pipelineContext não encontrado",
		);
	});
});
