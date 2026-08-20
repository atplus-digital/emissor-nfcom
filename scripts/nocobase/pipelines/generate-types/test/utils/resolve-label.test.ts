import { describe, expect, it } from "bun:test";
import type {
	DataSourceCollection,
	DataSourceField,
} from "@pipelines/generate-types/@types/script-data-source";
import {
	resolveCollectionLabel,
	resolveFieldLabel,
} from "@pipelines/generate-types/utils/resolve-label";

describe("resolveCollectionLabel", () => {
	it("uses collection.title when present", () => {
		const api: Pick<DataSourceCollection, "title"> = {
			title: "Contas a Receber",
		};
		expect(resolveCollectionLabel("fn_areceber", api)).toBe("Contas a Receber");
	});

	it("falls back to technical name when title is missing", () => {
		expect(resolveCollectionLabel("t_negociacoes")).toBe("t_negociacoes");
	});

	it("resolves i18n template keys to Portuguese", () => {
		const api: Pick<DataSourceCollection, "title"> = {
			title: '{{ t("Created at") }}',
		};
		expect(resolveCollectionLabel("users", api)).toBe("Criado em");
	});

	it("falls back to technical name when i18n key has no override", () => {
		const api: Pick<DataSourceCollection, "title"> = {
			title: '{{ t("Unknown key") }}',
		};
		expect(resolveCollectionLabel("t_foo", api)).toBe("t_foo");
	});
});

describe("resolveFieldLabel", () => {
	it("uses uiSchema.title when present", () => {
		const field: DataSourceField = {
			name: "f_email",
			type: "string",
			uiSchema: { title: "E-mail do cliente" },
		};
		expect(resolveFieldLabel(field)).toBe("E-mail do cliente");
	});

	it("falls back to field name when title is missing", () => {
		const field: DataSourceField = { name: "f_email", type: "string" };
		expect(resolveFieldLabel(field)).toBe("f_email");
	});

	it("resolves i18n template keys to Portuguese", () => {
		const field: DataSourceField = {
			name: "f_created_at",
			type: "date",
			uiSchema: { title: '{{ t("Created at") }}' },
		};
		expect(resolveFieldLabel(field)).toBe("Criado em");
	});

	it("keeps the raw label when i18n key has no override", () => {
		const field: DataSourceField = {
			name: "f_x",
			type: "string",
			uiSchema: { title: '{{ t("Unknown key") }}' },
		};
		expect(resolveFieldLabel(field)).toBe('{{ t("Unknown key") }}');
	});
});
