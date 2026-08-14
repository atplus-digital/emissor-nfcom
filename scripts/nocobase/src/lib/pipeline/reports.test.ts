import { describe, expect, it } from "bun:test";
import {
	addJsonReport,
	countReports,
	createReportsContext,
	renderReportsMarkdown,
} from "./reports";

describe("TC-UT-RPT-001: createReportsContext returns valid structure", () => {
	it("should return context with schemaVersion 1 and empty namespaces", () => {
		const context = createReportsContext();

		expect(context.schemaVersion).toBe(1);
		expect(context.namespaces).toEqual({});
	});
});

describe("TC-UT-RPT-002: addJsonReport accumulates reports", () => {
	it("should add a single report to context", () => {
		const context = createReportsContext();

		addJsonReport(context, {
			namespace: "test-namespace",
			key: "report-1",
			title: "Test Report",
			payload: { foo: "bar" },
			scope: { pipeline: "test-pipeline", stage: "stage-1" },
		});

		expect(countReports(context)).toBe(1);
		expect(context.namespaces["test-namespace"]).toBeDefined();
		expect(context.namespaces["test-namespace"].entries).toHaveLength(1);
	});

	it("should accumulate multiple reports in same namespace", () => {
		const context = createReportsContext();

		addJsonReport(context, {
			namespace: "test-namespace",
			key: "report-1",
			title: "Test Report 1",
			payload: { foo: "bar" },
			scope: { pipeline: "test-pipeline", stage: "stage-1" },
		});

		addJsonReport(context, {
			namespace: "test-namespace",
			key: "report-2",
			title: "Test Report 2",
			payload: { baz: "qux" },
			scope: { pipeline: "test-pipeline", stage: "stage-2" },
		});

		expect(countReports(context)).toBe(2);
		expect(context.namespaces["test-namespace"].entries).toHaveLength(2);
	});

	it("should create new namespace when adding to new namespace", () => {
		const context = createReportsContext();

		addJsonReport(context, {
			namespace: "namespace-a",
			key: "report-a",
			title: "Report A",
			payload: {},
			scope: { pipeline: "pipeline-a", stage: "stage-a" },
		});

		addJsonReport(context, {
			namespace: "namespace-b",
			key: "report-b",
			title: "Report B",
			payload: {},
			scope: { pipeline: "pipeline-b", stage: "stage-b" },
		});

		expect(Object.keys(context.namespaces)).toHaveLength(2);
		expect(countReports(context)).toBe(2);
	});

	it("should handle duplicate entryIds by suffixing", () => {
		const context = createReportsContext();

		addJsonReport(context, {
			namespace: "test",
			key: "same-key",
			title: "First",
			payload: {},
			scope: { pipeline: "p", stage: "s" },
		});

		addJsonReport(context, {
			namespace: "test",
			key: "same-key",
			title: "Second",
			payload: {},
			scope: { pipeline: "p", stage: "s" },
		});

		const entries = context.namespaces.test.entries;
		expect(entries[0].entryId).toBe("same-key");
		expect(entries[1].entryId).toBe("same-key-1");
	});

	it("should handle multiple duplicate entryIds (3+ collisions)", () => {
		const context = createReportsContext();

		addJsonReport(context, {
			namespace: "test",
			key: "duplicate",
			title: "First",
			payload: {},
			scope: { pipeline: "p", stage: "s" },
		});

		addJsonReport(context, {
			namespace: "test",
			key: "duplicate",
			title: "Second",
			payload: {},
			scope: { pipeline: "p", stage: "s" },
		});

		addJsonReport(context, {
			namespace: "test",
			key: "duplicate",
			title: "Third",
			payload: {},
			scope: { pipeline: "p", stage: "s" },
		});

		addJsonReport(context, {
			namespace: "test",
			key: "duplicate",
			title: "Fourth",
			payload: {},
			scope: { pipeline: "p", stage: "s" },
		});

		const entries = context.namespaces.test.entries;
		expect(entries[0].entryId).toBe("duplicate");
		expect(entries[1].entryId).toBe("duplicate-1");
		expect(entries[2].entryId).toBe("duplicate-2");
		expect(entries[3].entryId).toBe("duplicate-3");
	});
});

describe("TC-UT-RPT-003: addJsonReport sanitizes identifiers", () => {
	it("should sanitize namespace names", () => {
		const context = createReportsContext();

		addJsonReport(context, {
			namespace: "My Namespace!@#$",
			key: "report",
			title: "Test",
			payload: {},
			scope: { pipeline: "p", stage: "s" },
		});

		expect(context.namespaces["my-namespace"]).toBeDefined();
	});

	it("should sanitize key names", () => {
		const context = createReportsContext();

		addJsonReport(context, {
			namespace: "test",
			key: "Key With Spaces!@#",
			title: "Test",
			payload: {},
			scope: { pipeline: "p", stage: "s" },
		});

		const entries = context.namespaces.test.entries;
		expect(entries[0].entryId).toBe("key-with-spaces");
	});
});

describe("TC-UT-RPT-004: renderReportsMarkdown produces valid markdown", () => {
	it("should render markdown with title and summary", () => {
		const context = createReportsContext();

		addJsonReport(context, {
			namespace: "generate-types",
			key: "collection-report",
			title: "Collection Report",
			payload: { collectionName: "pessoas" },
			scope: { pipeline: "generate-types", stage: "stage-1" },
		});

		const markdown = renderReportsMarkdown(context);

		expect(markdown).toContain("# Relatório Consolidado");
		expect(markdown).toContain("Total de reports:");
		expect(markdown).toContain("generate-types");
	});

	it("should render empty report correctly", () => {
		const context = createReportsContext();
		const markdown = renderReportsMarkdown(context);

		expect(markdown).toContain("# Relatório Consolidado");
		expect(markdown).toContain("Total de reports: **0**");
		expect(markdown).toContain("| _nenhum_ | 0 |");
	});

	it("should include custom title when provided", () => {
		const context = createReportsContext();
		const markdown = renderReportsMarkdown(context, {
			title: "Custom Title",
		});

		expect(markdown).toContain("# Custom Title");
	});

	it("should include generatedAt timestamp", () => {
		const context = createReportsContext();
		const customDate = new Date("2024-01-01T00:00:00Z");
		const markdown = renderReportsMarkdown(context, {
			generatedAt: customDate,
		});

		expect(markdown).toContain("2024-01-01T00:00:00.000Z");
	});
});

describe("TC-UT-RPT-005: countReports returns accurate count", () => {
	it("should return 0 for empty context", () => {
		const context = createReportsContext();
		expect(countReports(context)).toBe(0);
	});

	it("should return correct count for single namespace", () => {
		const context = createReportsContext();

		addJsonReport(context, {
			namespace: "ns1",
			key: "r1",
			title: "R1",
			payload: {},
			scope: { pipeline: "p", stage: "s" },
		});

		addJsonReport(context, {
			namespace: "ns1",
			key: "r2",
			title: "R2",
			payload: {},
			scope: { pipeline: "p", stage: "s" },
		});

		expect(countReports(context)).toBe(2);
	});

	it("should sum across multiple namespaces", () => {
		const context = createReportsContext();

		addJsonReport(context, {
			namespace: "ns1",
			key: "r1",
			title: "R1",
			payload: {},
			scope: { pipeline: "p", stage: "s" },
		});

		addJsonReport(context, {
			namespace: "ns2",
			key: "r2",
			title: "R2",
			payload: {},
			scope: { pipeline: "p", stage: "s" },
		});

		addJsonReport(context, {
			namespace: "ns3",
			key: "r3",
			title: "R3",
			payload: {},
			scope: { pipeline: "p", stage: "s" },
		});

		expect(countReports(context)).toBe(3);
	});
});

describe("TC-UT-RPT-006: renderReportsMarkdown groups generate-types collections", () => {
	it("should group entries by collectionName for generate-types namespace", () => {
		const context = createReportsContext();

		addJsonReport(context, {
			namespace: "generate-types",
			key: "pessoas-1",
			title: "Pessoas Field 1",
			payload: { collectionName: "pessoas", field: "id" },
			scope: { pipeline: "generate-types", stage: "fetch" },
		});

		addJsonReport(context, {
			namespace: "generate-types",
			key: "pessoas-2",
			title: "Pessoas Field 2",
			payload: { collectionName: "pessoas", field: "nome" },
			scope: { pipeline: "generate-types", stage: "fetch" },
		});

		const markdown = renderReportsMarkdown(context);

		// Should have section for collection
		expect(markdown).toContain("## pessoas");
		// Should have section for non-collection entries
		expect(markdown).toContain("## generate-types");
	});

	it("should render generate-types entries without collectionName separately", () => {
		const context = createReportsContext();

		addJsonReport(context, {
			namespace: "generate-types",
			key: "summary",
			title: "Pipeline Summary",
			payload: { totalCollections: 2 },
			scope: { pipeline: "generate-types", stage: "summary" },
		});

		addJsonReport(context, {
			namespace: "generate-types",
			key: "users-field",
			title: "Users Field",
			payload: { collectionName: "users", field: "id" },
			scope: {
				pipeline: "generate-types",
				stage: "fetch",
				dataSourceKey: "nocobase",
			},
		});

		const markdown = renderReportsMarkdown(context);

		expect(markdown).toContain("### Pipeline Summary");
		expect(markdown).toContain("totalCollections");
		expect(markdown).toContain("## users");
		expect(markdown).toContain("datasource: `nocobase`");
	});

	it("should group multiple collections alphabetically for generate-types", () => {
		const context = createReportsContext();

		for (const collectionName of ["zebra", "alpha"]) {
			addJsonReport(context, {
				namespace: "generate-types",
				key: `${collectionName}-field`,
				title: `${collectionName} Field`,
				payload: { collectionName, field: "id" },
				scope: { pipeline: "generate-types", stage: "fetch" },
			});
		}

		const markdown = renderReportsMarkdown(context);
		const alphaIndex = markdown.indexOf("## alpha");
		const zebraIndex = markdown.indexOf("## zebra");

		expect(alphaIndex).toBeGreaterThan(-1);
		expect(zebraIndex).toBeGreaterThan(alphaIndex);
	});

	it("should render non-generate-types namespaces with flat entry list", () => {
		const context = createReportsContext();

		addJsonReport(context, {
			namespace: "custom-requests",
			key: "registry",
			title: "Registry Summary",
			payload: { entries: 3 },
			scope: {
				pipeline: "generate-custom-requests",
				stage: "write-output",
				dataSourceKey: "nocobase",
			},
		});

		const markdown = renderReportsMarkdown(context);

		expect(markdown).toContain("## custom-requests");
		expect(markdown).toContain("### Registry Summary");
		expect(markdown).toContain("datasource: `nocobase`");
		expect(markdown).toContain('"entries": 3');
	});

	it("should include dataSourceKey in grouped collection entries for generate-types", () => {
		const context = createReportsContext();

		addJsonReport(context, {
			namespace: "generate-types",
			key: "empresas-1",
			title: "Empresas Field",
			payload: { collectionName: "empresas", field: "id" },
			scope: {
				pipeline: "generate-types",
				stage: "fetch",
				dataSourceKey: "nocobase",
			},
		});

		const markdown = renderReportsMarkdown(context);

		// Should include datasource in the output
		expect(markdown).toContain("datasource: `nocobase`");
	});
});
