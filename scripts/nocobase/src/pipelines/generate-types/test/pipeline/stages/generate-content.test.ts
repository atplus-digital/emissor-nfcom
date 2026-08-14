import { generateContentStage } from "@generators/pipelines/generate-types/stages/generate-content";
import { describe, expect, it } from "bun:test";
import { createMockGeneratedTypes } from "../../factories";
import { createMockTask, createPipelineContext } from "../../helpers";

describe("generateContentStage", () => {
	it("writes flat index.ts when there are no split collections", async () => {
		const usersTypes = createMockGeneratedTypes({ id: "number" });
		const context = createPipelineContext({
			pipelineContext: {
				collectionTypes: { users: usersTypes },
				mainCollections: { users: usersTypes },
				splitCollections: new Map(),
			},
		});

		const result = await generateContentStage(context, createMockTask());
		const files = result.pipelineContext?.fileContents;

		expect(files?.size).toBe(1);
		expect(files?.has("index.ts")).toBe(true);
		expect(files?.get("index.ts")).toContain("export interface Users");
	});

	it("uses _main.ts when main collections are empty and no split", async () => {
		const context = createPipelineContext({
			pipelineContext: {
				collectionTypes: {},
				mainCollections: {},
				splitCollections: new Map(),
			},
		});

		const result = await generateContentStage(context, createMockTask());

		expect(result.pipelineContext?.fileContents?.has("_main.ts")).toBe(true);
	});

	it("generates split folder layout with collections.ts and per-collection files", async () => {
		const usersTypes = createMockGeneratedTypes({ id: "number" });
		const ordersTypes = createMockGeneratedTypes({ id: "number" });
		const collectionTypes = {
			users: usersTypes,
			t_orders: ordersTypes,
		};

		const context = createPipelineContext({
			runtimeConfig: { splitCollections: ["t_orders"] },
			pipelineContext: {
				collectionTypes,
				mainCollections: { users: usersTypes },
				splitCollections: new Map([["t_orders", { t_orders: ordersTypes }]]),
			},
		});

		const result = await generateContentStage(context, createMockTask());
		const files = result.pipelineContext?.fileContents;

		expect(files?.has("collections.ts")).toBe(true);
		expect(files?.has("index.ts")).toBe(true);
		expect(files?.get("collections.ts")).toContain("CollectionName");
		expect(files?.has("orders/labels.ts")).toBe(true);
		expect(files?.has("orders/schemas.ts")).toBe(true);
		expect(files?.has("orders/index.ts")).toBe(true);
		expect(files?.has("other/users/labels.ts")).toBe(true);
		expect(files?.has("other/users/schemas.ts")).toBe(true);
		expect(files?.has("other/users/index.ts")).toBe(true);
	});

	it("throws when pipelineContext is missing", async () => {
		const context = createPipelineContext();
		// @ts-expect-error — simula contexto inválido
		context.pipelineContext = undefined;

		await expect(
			generateContentStage(context, createMockTask()),
		).rejects.toThrow("pipelineContext não encontrado");
	});

	it("throws when build-types output is missing", async () => {
		const context = createPipelineContext({
			pipelineContext: {
				collectionTypes: {},
			},
		});

		await expect(
			generateContentStage(context, createMockTask()),
		).rejects.toThrow("mainCollections/splitCollections não encontrados");
	});
});
