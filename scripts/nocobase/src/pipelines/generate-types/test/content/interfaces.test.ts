import {
	generateBaseSchema,
	generateCreateSchema,
	generateMergedMainSchema,
	generateRelationSchema,
	generateUpdateSchema,
} from "@generators/pipelines/generate-types/content/interfaces";
import { describe, expect, it } from "vitest";
import { createMockGeneratedTypes } from "../factories";

describe("interfaces schema generation", () => {
	it("generateBaseSchema returns null-equivalent empty object for no scalars", () => {
		const types = createMockGeneratedTypes();
		const result = generateBaseSchema("users", types);
		expect(result).toContain("usersBaseSchema = z.object({");
		expect(result).toContain("});");
	});

	it("generateRelationSchema references external collection schemas", () => {
		const types = createMockGeneratedTypes(
			{ id: "number" },
			{
				f_department: {
					type: "belongsTo",
					targetCollection: "departments",
				},
			},
		);

		const { content } = generateRelationSchema(
			"users",
			types,
			new Set(["users", "departments"]),
		);

		expect(content).toContain("usersRelationSchema");
		expect(content).toContain("z.lazy(() => departmentsBaseSchema");
	});

	it("generateMergedMainSchema extends relation shape when relations exist", () => {
		const types = createMockGeneratedTypes(
			{ id: "number" },
			{ owner: { type: "belongsTo", targetCollection: "users" } },
		);

		const result = generateMergedMainSchema("t_orders", types);

		expect(result).toContain("ordersSchema = ordersBaseSchema.extend");
		expect(result).toContain("ordersRelationSchema.shape");
	});

	it("generateCreateSchema omits audit and relation fields", () => {
		const types = createMockGeneratedTypes(
			{
				id: "number",
				createdAt: "string",
				createdById: "number",
				updatedById: "number",
			},
			{ department: { type: "belongsTo", targetCollection: "departments" } },
		);

		const result = generateCreateSchema("users", types);

		expect(result).toContain("usersCreateSchema");
		expect(result).toContain("id: true");
		expect(result).toContain("createdById: true");
		expect(result).toContain("department: true");
	});

	it("generateUpdateSchema produces partial create schema", () => {
		const types = createMockGeneratedTypes({ id: "number", name: "string" });
		const result = generateUpdateSchema("users", types);

		expect(result).toContain("usersUpdateSchema");
		expect(result).toContain(".partial()");
	});
});
