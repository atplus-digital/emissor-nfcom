import type { DataSourceCollection } from "@generators/pipelines/generate-types/@types/script-data-source";
import { resolveCollectionLabel } from "@generators/pipelines/generate-types/utils/resolve-collection-label";
import { describe, expect, it } from "vitest";

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
});
