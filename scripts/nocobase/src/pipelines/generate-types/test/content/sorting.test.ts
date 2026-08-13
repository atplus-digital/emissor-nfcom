import {
	_sortMapEntries,
	_sortScalarEntries,
} from "@generators/pipelines/generate-types/content/sorting";
import { describe, expect, it } from "vitest";

describe("field sorting helpers", () => {
	it("orders scalar fields by category then alphabetically", () => {
		const map = new Map<string, string>([
			["createdAt", "string"],
			["f_fk_user", "number"],
			["name", "string"],
			["id", "number"],
			["f_id_client_ixc", "number"],
			["updatedById", "number"],
			["createdById", "number"],
		]);

		const sorted = _sortScalarEntries(map).map(([name]) => name);

		expect(sorted).toEqual([
			"id",
			"f_fk_user",
			"f_id_client_ixc",
			"name",
			"updatedById",
			"createdAt",
			"createdById",
		]);
	});

	it("sorts map entries alphabetically by key", () => {
		const map = new Map([
			["zebra", 1],
			["alfa", 2],
			["beta", 3],
		]);

		expect(_sortMapEntries(map).map(([key]) => key)).toEqual([
			"alfa",
			"beta",
			"zebra",
		]);
	});

	it("keeps same-category fields in locale order", () => {
		const map = new Map([
			["f_fk_z", "number"],
			["f_fk_a", "number"],
		]);

		expect(_sortScalarEntries(map).map(([name]) => name)).toEqual([
			"f_fk_a",
			"f_fk_z",
		]);
	});
});
