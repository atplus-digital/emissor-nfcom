import { describe, expect, it } from "bun:test";
import { buildTypes } from "@pipelines/generate-types/stages/build-types";
import {
	createMockCollectionTypesMap,
	createMockGeneratedTypes,
} from "../../factories";
import { createMockTask, createPipelineContext } from "../../helpers";

describe("buildTypes stage", () => {
	it("splits collections according to splitCollections config", async () => {
		const collectionTypes = createMockCollectionTypesMap({
			users: { scalars: { id: "number" } },
			orders: { scalars: { id: "number" } },
			products: { scalars: { id: "number" } },
		});

		const context = createPipelineContext({
			runtimeConfig: { splitCollections: ["users", "orders"] },
			pipelineContext: { collectionTypes },
		});

		const result = await buildTypes(context, createMockTask());

		expect(Object.keys(result.pipelineContext?.mainCollections ?? {})).toEqual([
			"products",
		]);
		expect(result.pipelineContext?.splitCollections?.has("users")).toBe(true);
		expect(result.pipelineContext?.splitCollections?.has("orders")).toBe(true);
		expect(result.pipelineContext?.splitCollections?.size).toBe(2);
	});

	it("keeps all collections in main when splitCollections is empty", async () => {
		const collectionTypes = createMockCollectionTypesMap({
			users: { scalars: { id: "number" } },
		});

		const context = createPipelineContext({
			runtimeConfig: { splitCollections: [] },
			pipelineContext: { collectionTypes },
		});

		const result = await buildTypes(context, createMockTask());

		expect(result.pipelineContext?.mainCollections).toEqual(collectionTypes);
		expect(result.pipelineContext?.splitCollections?.size).toBe(0);
	});

	it("throws when collectionTypes is missing", async () => {
		const context = createPipelineContext({ pipelineContext: {} });

		await expect(buildTypes(context, createMockTask())).rejects.toThrow(
			"collectionTypes não encontrado",
		);
	});

	it("stores single-collection map per split entry", async () => {
		const usersTypes = createMockGeneratedTypes({ id: "number" });
		const collectionTypes = { users: usersTypes };

		const context = createPipelineContext({
			runtimeConfig: { splitCollections: ["users"] },
			pipelineContext: { collectionTypes },
		});

		const result = await buildTypes(context, createMockTask());
		const splitUsers = result.pipelineContext?.splitCollections?.get("users");

		expect(splitUsers).toEqual({ users: usersTypes });
	});
});
