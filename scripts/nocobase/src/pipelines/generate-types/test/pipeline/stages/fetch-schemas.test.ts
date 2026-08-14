import type { GenerateTypesPipelineCtx } from "@generators/pipelines/generate-types/stages/fetch-schemas";
import { fetchSchemas } from "@generators/pipelines/generate-types/stages/fetch-schemas";
import { describe, expect, it, vi } from "bun:test";
import { createMockField } from "../../factories";
import {
	createMockDataSourceConfig,
	createMockTask,
	createPipelineContext,
} from "../../helpers";

describe("fetchSchemas stage", () => {
	it("fetches collections from API when includeAllCollections is true", async () => {
		const fetchCollections = vi.fn().mockResolvedValue([
			{
				name: "users",
				fields: [
					createMockField({ name: "id", type: "integer", interface: "id" }),
					createMockField({
						name: "username",
						type: "string",
						interface: "input",
					}),
				],
			},
		]);

		const context = createPipelineContext({
			runtimeConfig: {
				includeAllCollections: true,
				collections: [],
				splitCollections: [],
			},
			pipelineContext: {
				client: { baseUrl: "http://localhost", fetchCollections },
			},
		});

		const result = await fetchSchemas(context, createMockTask());

		expect(fetchCollections).toHaveBeenCalledWith("main");
		expect(
			result.pipelineContext?.collectionTypes?.users?.scalars.get("id"),
		).toBe("number");
		expect(
			result.pipelineContext?.collectionTypes?.users?.scalars.get("username"),
		).toBe("string");
	});

	it("respects excludeFields", async () => {
		const fetchCollections = vi.fn().mockResolvedValue([
			{
				name: "users",
				fields: [
					createMockField({ name: "username", type: "string" }),
					createMockField({
						name: "createdById",
						type: "context",
						interface: "context",
					}),
				],
			},
		]);

		const context = createPipelineContext({
			runtimeConfig: {
				collections: ["users"],
				excludeFields: ["createdById"],
			},
			pipelineContext: {
				client: { baseUrl: "http://localhost", fetchCollections },
			},
		});

		const result = await fetchSchemas(context, createMockTask());
		const usersTypes = result.pipelineContext?.collectionTypes?.users;

		expect(usersTypes?.scalars.has("username")).toBe(true);
		expect(usersTypes?.scalars.has("createdById")).toBe(false);
	});

	it("throws when client is missing", async () => {
		const context = createPipelineContext({
			pipelineContext: {
				dataSource: createMockDataSourceConfig({ collections: ["users"] }),
			},
		});

		await expect(fetchSchemas(context, createMockTask())).rejects.toThrow(
			"client não encontrado",
		);
	});

	it("throws when no collections are configured", async () => {
		const fetchCollections = vi.fn().mockResolvedValue([]);

		const context = createPipelineContext({
			runtimeConfig: { collections: [], splitCollections: [] },
			pipelineContext: {
				client: { baseUrl: "http://localhost", fetchCollections },
			},
		});

		await expect(fetchSchemas(context, createMockTask())).rejects.toThrow(
			"não possui collections para processar",
		);
	});

	it("resolves i18n template labels to Portuguese overrides", async () => {
		const fetchCollections = vi.fn().mockResolvedValue([
			{
				name: "users",
				fields: [
					createMockField({
						name: "email",
						type: "string",
						uiSchema: { title: '{{ t("Email") }}' },
					}),
				],
			},
		]);

		const context = createPipelineContext({
			runtimeConfig: { collections: ["users"] },
			pipelineContext: {
				client: { baseUrl: "http://localhost", fetchCollections },
			},
		});

		const result = await fetchSchemas(context, createMockTask());

		expect(
			result.pipelineContext?.collectionTypes?.users?.fieldLabels.get("email"),
		).toBe("E-mail");
	});

	it("applies manual relation mappings not present in API fields", async () => {
		const fetchCollections = vi.fn().mockResolvedValue([
			{ name: "users", fields: [{ name: "id", type: "integer" }] },
			{ name: "departments", fields: [{ name: "id", type: "integer" }] },
		]);

		const context = createPipelineContext({
			runtimeConfig: { collections: ["users", "departments"] },
			pipelineContext: {
				client: { baseUrl: "http://localhost", fetchCollections },
				relations: {
					users: {
						department: { target: "departments", type: "belongsTo" },
					},
				},
			},
		});

		const result = await fetchSchemas(context, createMockTask());
		const relation =
			result.pipelineContext?.collectionTypes?.users?.relations.get(
				"department",
			);

		expect(relation?.targetCollection).toBe("departments");
		expect(relation?.type).toBe("belongsTo");
	});

	it("includes dependent collections when includeDependents is enabled", async () => {
		const fetchCollections = vi.fn().mockResolvedValue([
			{
				name: "t_orders",
				fields: [
					createMockField({
						name: "f_user",
						type: "belongsTo",
						interface: "m2o",
						target: "users",
					}),
				],
			},
			{
				name: "users",
				fields: [createMockField({ name: "id", type: "integer" })],
			},
		]);

		const context = createPipelineContext({
			runtimeConfig: {
				collections: [],
				splitCollections: ["t_orders"],
				includeDependents: true,
			},
			pipelineContext: {
				client: { baseUrl: "http://localhost", fetchCollections },
			},
		});

		const result = await fetchSchemas(context, createMockTask());

		expect(result.pipelineContext?.collectionTypes?.users).toBeDefined();
		expect(result.pipelineContext?.collectionTypes?.t_orders).toBeDefined();
	});

	it("tracks unresolved relations when target collection is unknown", async () => {
		const fetchCollections = vi.fn().mockResolvedValue([
			{
				name: "users",
				fields: [
					createMockField({
						name: "f_ghost",
						type: "belongsTo",
						interface: "m2o",
						target: "missing_collection",
					}),
				],
			},
		]);

		const context = createPipelineContext({
			runtimeConfig: { collections: ["users"] },
			pipelineContext: {
				client: { baseUrl: "http://localhost", fetchCollections },
			},
		});

		const result = await fetchSchemas(context, createMockTask());

		expect(result.pipelineContext?.unresolvedRelations).toEqual([
			{
				collection: "users",
				field: "f_ghost",
				target: "missing_collection",
			},
		]);
		expect(
			result.pipelineContext?.collectionTypes?.users?.relations.get("f_ghost")
				?.targetCollection,
		).toBe("");
	});

	it("wraps API errors when listing collections fails", async () => {
		const fetchCollections = vi
			.fn()
			.mockRejectedValue(new Error("network down"));

		const context = createPipelineContext({
			runtimeConfig: { collections: ["users"] },
			pipelineContext: {
				client: { baseUrl: "http://localhost", fetchCollections },
			},
		});

		await expect(fetchSchemas(context, createMockTask())).rejects.toThrow(
			"Falha ao listar collections",
		);
	});

	it("infers relations from field names when enabled", async () => {
		const fetchCollections = vi.fn().mockResolvedValue([
			{
				name: "users",
				fields: [createMockField({ name: "f_departments", type: "integer" })],
			},
			{ name: "departments", fields: [] },
		]);

		const context = createPipelineContext({
			runtimeConfig: {
				collections: ["users", "departments"],
				inferRelationsByName: true,
			},
			pipelineContext: {
				client: { baseUrl: "http://localhost", fetchCollections },
			},
		});

		const result = await fetchSchemas(context, createMockTask());
		const relation =
			result.pipelineContext?.collectionTypes?.users?.relations.get(
				"f_departments",
			);

		expect(relation?.type).toBe("belongsTo");
		expect(relation?.targetCollection).toBe("departments");
	});

	it("marks schemaAvailable false when collection is missing from API payload", async () => {
		const fetchCollections = vi.fn().mockResolvedValue([]);

		const context = createPipelineContext({
			runtimeConfig: { collections: ["orphan"] },
			pipelineContext: {
				client: { baseUrl: "http://localhost", fetchCollections },
			},
		});

		const result = await fetchSchemas(context, createMockTask());

		expect(
			result.pipelineContext?.collectionTypes?.orphan?.schemaAvailable,
		).toBe(false);
	});

	it("updates progress output every 25 collections", async () => {
		const collectionNames = Array.from({ length: 26 }, (_, i) => `col_${i}`);
		const fetchCollections = vi.fn().mockResolvedValue(
			collectionNames.map((name) => ({
				name,
				fields: [createMockField({ name: "id", type: "integer" })],
			})),
		);

		const progressMessages: string[] = [];
		let output = "";
		const task = {
			get output() {
				return output;
			},
			set output(value: string) {
				progressMessages.push(value);
				output = value;
			},
		} as ReturnType<typeof createMockTask>;

		const context = createPipelineContext({
			runtimeConfig: { collections: collectionNames },
			pipelineContext: {
				client: { baseUrl: "http://localhost", fetchCollections },
			},
		});

		await fetchSchemas(context, task);

		expect(
			progressMessages.some(
				(message) => message.includes("[26/26]") && message.includes("col_25"),
			),
		).toBe(true);
	});

	it("stores dependent collection names when includeDependents is enabled", async () => {
		const fetchCollections = vi.fn().mockResolvedValue([
			{
				name: "t_orders",
				fields: [
					createMockField({
						name: "f_user",
						type: "belongsTo",
						interface: "m2o",
						target: "users",
					}),
				],
			},
			{
				name: "users",
				fields: [createMockField({ name: "id", type: "integer" })],
			},
		]);

		const context = createPipelineContext({
			runtimeConfig: {
				collections: [],
				splitCollections: ["t_orders"],
				includeDependents: true,
			},
			pipelineContext: {
				client: { baseUrl: "http://localhost", fetchCollections },
			},
		});

		const result = await fetchSchemas(context, createMockTask());

		expect(
			result.pipelineContext?.collections?.map((c) => c.name).sort(),
		).toEqual(["t_orders", "users"].sort());
	});

	it("includes all API collections when includeAllCollections is enabled", async () => {
		const fetchCollections = vi.fn().mockResolvedValue([
			{
				name: "users",
				fields: [createMockField({ name: "id", type: "integer" })],
			},
			{
				name: "posts",
				fields: [createMockField({ name: "id", type: "integer" })],
			},
		]);

		const context = createPipelineContext({
			runtimeConfig: {
				includeAllCollections: true,
				collections: ["users"],
				splitCollections: [],
			},
			pipelineContext: {
				client: { baseUrl: "http://localhost", fetchCollections },
			},
		});

		const result = await fetchSchemas(context, createMockTask());

		expect(result.pipelineContext?.collectionTypes?.users).toBeDefined();
		expect(result.pipelineContext?.collectionTypes?.posts).toBeDefined();
	});

	it("extracts enum options from uiSchema.enum objects and flat values", async () => {
		const fetchCollections = vi.fn().mockResolvedValue([
			{
				name: "users",
				fields: [
					createMockField({
						name: "f_status",
						type: "string",
						uiSchema: {
							enum: [{ value: "a", label: "Active" }, "b"],
						},
					}),
				],
			},
		]);

		const context = createPipelineContext({
			runtimeConfig: { collections: ["users"] },
			pipelineContext: {
				client: { baseUrl: "http://localhost", fetchCollections },
			},
		});

		const result = await fetchSchemas(context, createMockTask());
		const enums =
			result.pipelineContext?.collectionTypes?.users?.enums.get("f_status");

		expect(enums).toEqual([
			{ value: "a", label: "Active" },
			{ value: "b", label: "b" },
		]);
	});

	it("adds dependent collection when manual mapping targets split collection", async () => {
		const fetchCollections = vi.fn().mockResolvedValue([
			{
				name: "users",
				fields: [createMockField({ name: "id", type: "integer" })],
			},
			{
				name: "departments",
				fields: [createMockField({ name: "id", type: "integer" })],
			},
		]);

		const context = createPipelineContext({
			runtimeConfig: {
				collections: [],
				splitCollections: ["departments"],
				includeDependents: true,
			},
			pipelineContext: {
				client: { baseUrl: "http://localhost", fetchCollections },
				relations: {
					users: {
						department: { target: "departments", type: "belongsTo" },
					},
				},
			},
		});

		const result = await fetchSchemas(context, createMockTask());

		expect(result.pipelineContext?.collectionTypes?.users).toBeDefined();
		expect(result.pipelineContext?.collectionTypes?.departments).toBeDefined();
	});

	it("tracks unresolved manual relations when target is unknown", async () => {
		const fetchCollections = vi.fn().mockResolvedValue([
			{
				name: "users",
				fields: [createMockField({ name: "id", type: "integer" })],
			},
		]);

		const context = createPipelineContext({
			runtimeConfig: { collections: ["users"] },
			pipelineContext: {
				client: { baseUrl: "http://localhost", fetchCollections },
				relations: {
					users: {
						ghost: { target: "missing", type: "belongsTo" },
					},
				},
			},
		});

		const result = await fetchSchemas(context, createMockTask());

		expect(result.pipelineContext?.unresolvedRelations).toEqual([
			{ collection: "users", field: "ghost", target: "missing" },
		]);
	});

	it("uses field name when uiSchema title is empty", async () => {
		const fetchCollections = vi.fn().mockResolvedValue([
			{
				name: "users",
				fields: [
					createMockField({ name: "nickname", type: "string", uiSchema: {} }),
				],
			},
		]);

		const context = createPipelineContext({
			runtimeConfig: { collections: ["users"] },
			pipelineContext: {
				client: { baseUrl: "http://localhost", fetchCollections },
			},
		});

		const result = await fetchSchemas(context, createMockTask());

		expect(
			result.pipelineContext?.collectionTypes?.users?.fieldLabels.get(
				"nickname",
			),
		).toBe("nickname");
	});

	it("wraps non-Error failures when listing collections", async () => {
		const fetchCollections = vi.fn().mockRejectedValue("timeout");

		const context = createPipelineContext({
			runtimeConfig: { collections: ["users"] },
			pipelineContext: {
				client: { baseUrl: "http://localhost", fetchCollections },
			},
		});

		await expect(fetchSchemas(context, createMockTask())).rejects.toThrow(
			"Falha ao listar collections",
		);
	});

	it("uses plain uiSchema title when not an i18n template", async () => {
		const fetchCollections = vi.fn().mockResolvedValue([
			{
				name: "users",
				fields: [
					createMockField({
						name: "displayName",
						type: "string",
						uiSchema: { title: "Nome de exibição" },
					}),
				],
			},
		]);

		const context = createPipelineContext({
			runtimeConfig: { collections: ["users"] },
			pipelineContext: {
				client: { baseUrl: "http://localhost", fetchCollections },
			},
		});

		const result = await fetchSchemas(context, createMockTask());

		expect(
			result.pipelineContext?.collectionTypes?.users?.fieldLabels.get(
				"displayName",
			),
		).toBe("Nome de exibição");
	});

	it("returns no dependents when splitCollections is empty with includeDependents", async () => {
		const fetchCollections = vi.fn().mockResolvedValue([
			{
				name: "users",
				fields: [createMockField({ name: "id", type: "integer" })],
			},
		]);

		const context = createPipelineContext({
			runtimeConfig: {
				collections: ["users"],
				splitCollections: [],
				includeDependents: true,
			},
			pipelineContext: {
				client: { baseUrl: "http://localhost", fetchCollections },
			},
		});

		const result = await fetchSchemas(context, createMockTask());

		expect(result.pipelineContext?.collectionTypes?.users).toBeDefined();
		expect(result.pipelineContext?.collections?.map((c) => c.name)).toEqual([
			"users",
		]);
	});

	it("includes outbound manual relation targets from split collection", async () => {
		const fetchCollections = vi.fn().mockResolvedValue([
			{
				name: "t_orders",
				fields: [createMockField({ name: "id", type: "integer" })],
			},
			{
				name: "users",
				fields: [createMockField({ name: "id", type: "integer" })],
			},
		]);

		const context = createPipelineContext({
			runtimeConfig: {
				collections: [],
				splitCollections: ["t_orders"],
				includeDependents: true,
			},
			pipelineContext: {
				client: { baseUrl: "http://localhost", fetchCollections },
				relations: {
					t_orders: {
						f_user: { target: "users", type: "belongsTo" },
					},
				},
			},
		});

		const result = await fetchSchemas(context, createMockTask());

		expect(result.pipelineContext?.collectionTypes?.users).toBeDefined();
		expect(result.pipelineContext?.collectionTypes?.t_orders).toBeDefined();
	});

	it("includes inbound field dependents pointing to split collection", async () => {
		const fetchCollections = vi.fn().mockResolvedValue([
			{
				name: "posts",
				fields: [
					createMockField({
						name: "f_department",
						type: "belongsTo",
						interface: "m2o",
						target: "departments",
					}),
				],
			},
			{
				name: "departments",
				fields: [createMockField({ name: "id", type: "integer" })],
			},
		]);

		const context = createPipelineContext({
			runtimeConfig: {
				collections: [],
				splitCollections: ["departments"],
				includeDependents: true,
			},
			pipelineContext: {
				client: { baseUrl: "http://localhost", fetchCollections },
			},
		});

		const result = await fetchSchemas(context, createMockTask());

		expect(result.pipelineContext?.collectionTypes?.posts).toBeDefined();
		expect(result.pipelineContext?.collectionTypes?.departments).toBeDefined();
	});

	it("deduplicates and trims configured collection names", async () => {
		const fetchCollections = vi.fn().mockResolvedValue([
			{
				name: "users",
				fields: [createMockField({ name: "id", type: "integer" })],
			},
		]);

		const context = createPipelineContext({
			runtimeConfig: {
				collections: [" users ", "users", "", "users"],
				splitCollections: [" users "],
			},
			pipelineContext: {
				client: { baseUrl: "http://localhost", fetchCollections },
			},
		});

		const result = await fetchSchemas(context, createMockTask());

		expect(Object.keys(result.pipelineContext?.collectionTypes ?? {})).toEqual([
			"users",
		]);
	});

	it("skips manual relation mapping when field relation already exists", async () => {
		const fetchCollections = vi.fn().mockResolvedValue([
			{
				name: "users",
				fields: [
					createMockField({
						name: "department",
						type: "belongsTo",
						interface: "m2o",
						target: "departments",
					}),
				],
			},
			{
				name: "departments",
				fields: [createMockField({ name: "id", type: "integer" })],
			},
		]);

		const context = createPipelineContext({
			runtimeConfig: { collections: ["users", "departments"] },
			pipelineContext: {
				client: { baseUrl: "http://localhost", fetchCollections },
				relations: {
					users: {
						department: { target: "departments", type: "belongsTo" },
					},
				},
			},
		});

		const result = await fetchSchemas(context, createMockTask());
		const relation =
			result.pipelineContext?.collectionTypes?.users?.relations.get(
				"department",
			);

		expect(relation?.targetCollection).toBe("departments");
		expect(relation?.type).toBe("belongsTo");
		expect(result.pipelineContext?.collectionTypes?.users?.relations.size).toBe(
			1,
		);
	});

	it("does not track unresolved relations when target is empty", async () => {
		const fetchCollections = vi.fn().mockResolvedValue([
			{
				name: "users",
				fields: [
					createMockField({
						name: "f_orphan",
						type: "belongsTo",
						interface: "m2o",
						target: "",
					}),
				],
			},
		]);

		const context = createPipelineContext({
			runtimeConfig: { collections: ["users"] },
			pipelineContext: {
				client: { baseUrl: "http://localhost", fetchCollections },
			},
		});

		const result = await fetchSchemas(context, createMockTask());

		expect(result.pipelineContext?.unresolvedRelations).toEqual([]);
		expect(
			result.pipelineContext?.collectionTypes?.users?.relations.get("f_orphan")
				?.targetCollection,
		).toBe("");
	});

	it("returns explicit collections when includeDependents is disabled", async () => {
		const fetchCollections = vi.fn().mockResolvedValue([
			{
				name: "t_orders",
				fields: [
					createMockField({
						name: "f_user",
						type: "belongsTo",
						interface: "m2o",
						target: "users",
					}),
				],
			},
			{
				name: "users",
				fields: [createMockField({ name: "id", type: "integer" })],
			},
		]);

		const context = createPipelineContext({
			runtimeConfig: {
				collections: [],
				splitCollections: ["t_orders"],
				includeDependents: false,
			},
			pipelineContext: {
				client: { baseUrl: "http://localhost", fetchCollections },
			},
		});

		const result = await fetchSchemas(context, createMockTask());

		expect(result.pipelineContext?.collections?.map((c) => c.name)).toEqual([
			"t_orders",
		]);
		expect(result.pipelineContext?.collectionTypes?.users).toBeUndefined();
	});

	it("shows dependents summary in task output when includeDependents resolves extras", async () => {
		const fetchCollections = vi.fn().mockResolvedValue([
			{
				name: "t_orders",
				fields: [
					createMockField({
						name: "f_user",
						type: "belongsTo",
						interface: "m2o",
						target: "users",
					}),
				],
			},
			{
				name: "users",
				fields: [createMockField({ name: "id", type: "integer" })],
			},
		]);

		const progressMessages: string[] = [];
		let output = "";
		const task = {
			get output() {
				return output;
			},
			set output(value: string) {
				progressMessages.push(value);
				output = value;
			},
		} as ReturnType<typeof createMockTask>;

		const context = createPipelineContext({
			runtimeConfig: {
				collections: [],
				splitCollections: ["t_orders"],
				includeDependents: true,
			},
			pipelineContext: {
				client: { baseUrl: "http://localhost", fetchCollections },
			},
		});

		await fetchSchemas(context, task);

		expect(
			progressMessages.some((message) =>
				message.includes("(+1 dependente(s))"),
			),
		).toBe(true);
	});

	it("throws when pipelineContext is undefined", async () => {
		const context = createPipelineContext({
			pipelineContext: undefined as unknown as GenerateTypesPipelineCtx,
		});
		context.pipelineContext = undefined;

		await expect(fetchSchemas(context, createMockTask())).rejects.toThrow(
			"client não encontrado",
		);
	});

	it("keeps raw i18n template when override is unknown", async () => {
		const fetchCollections = vi.fn().mockResolvedValue([
			{
				name: "users",
				fields: [
					createMockField({
						name: "custom",
						type: "string",
						uiSchema: { title: '{{ t("UnknownKey") }}' },
					}),
				],
			},
		]);

		const context = createPipelineContext({
			runtimeConfig: { collections: ["users"] },
			pipelineContext: {
				client: { baseUrl: "http://localhost", fetchCollections },
			},
		});

		const result = await fetchSchemas(context, createMockTask());

		expect(
			result.pipelineContext?.collectionTypes?.users?.fieldLabels.get("custom"),
		).toBe('{{ t("UnknownKey") }}');
	});
});
