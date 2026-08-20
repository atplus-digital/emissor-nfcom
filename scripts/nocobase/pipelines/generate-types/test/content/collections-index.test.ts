import { describe, expect, it } from "bun:test";
import { generateCollectionsFile } from "@pipelines/generate-types/content/collections-index";
import { createMockCollectionTypesMap } from "../factories";

describe("generateCollectionsFile", () => {
	it("generates empty maps and never union for no collections", () => {
		const result = generateCollectionsFile({});

		expect(result).toContain("export type CollectionName =\nnever;");
		expect(result).toContain("export interface CollectionMap {}");
		expect(result).toContain("export const COLLECTIONS = [] as const;");
	});

	it("formats short collection name union inline", () => {
		const types = createMockCollectionTypesMap({
			users: { scalars: { id: "number" } },
			posts: { scalars: { id: "number" } },
		});

		const result = generateCollectionsFile(types);

		expect(result).toContain('"posts" | "users"');
	});

	it("formats long collection name union with multiline branches", () => {
		const names = ["c1", "c2", "c3", "c4", "c5", "c6"];
		const types = createMockCollectionTypesMap(
			Object.fromEntries(names.map((n) => [n, { scalars: { id: "number" } }])),
		);

		const result = generateCollectionsFile(types);

		expect(result).toContain('export type CollectionName =\n\t| "c1"');
		expect(result).toContain('\t| "c6"');
	});

	it("formats COLLECTIONS const with multiline array when > 10 items", () => {
		const names = Array.from({ length: 11 }, (_, i) => `col_${i}`);
		const types = createMockCollectionTypesMap(
			Object.fromEntries(names.map((n) => [n, { scalars: { id: "number" } }])),
		);

		const result = generateCollectionsFile(types);

		expect(result).toContain("export const COLLECTIONS = [");
		expect(result).toContain('\t"col_0",');
		expect(result).toContain('\t"col_10"');
	});

	it("imports types using custom collection paths", () => {
		const types = createMockCollectionTypesMap({
			users: { scalars: { id: "number" } },
			t_orders: { scalars: { id: "number" } },
		});
		const paths = new Map([
			["users", "./other/users"],
			["t_orders", "./orders"],
		]);

		const result = generateCollectionsFile(types, { suffix: "Base" }, paths);

		expect(result).toContain(
			'import type { UsersBase, UsersRelations } from "./other/users";',
		);
		expect(result).toContain(
			'import type { OrdersBase, OrdersRelations } from "./orders";',
		);
		expect(result).toContain('"t_orders": OrdersBase;');
	});
});
