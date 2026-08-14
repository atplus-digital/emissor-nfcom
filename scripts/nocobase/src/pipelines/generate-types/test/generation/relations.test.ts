import {
	getRelationCardinality,
	inferRelationFromFieldName,
	renderRelationValueType,
	renderRelationZodType,
	resolveRelationByType,
	resolveRelationInterface,
} from "@generators/pipelines/generate-types/content/relations";
import { describe, expect, it } from "bun:test";

describe("resolveRelationInterface", () => {
	it("returns null for null input", () => {
		expect(resolveRelationInterface(null)).toBeNull();
	});

	it("returns null for undefined input", () => {
		expect(resolveRelationInterface(undefined)).toBeNull();
	});

	it("returns null for empty string", () => {
		expect(resolveRelationInterface("")).toBeNull();
	});

	it("returns null for whitespace-only string", () => {
		expect(resolveRelationInterface("   ")).toBeNull();
	});

	it("returns 'm2o' for 'm2o' input", () => {
		expect(resolveRelationInterface("m2o")).toBe("m2o");
	});

	it("returns 'belongsTo' for 'belongsto' (case insensitive)", () => {
		expect(resolveRelationInterface("belongsto")).toBe("belongsTo");
	});

	it("returns 'belongsTo' for 'BelongsTo'", () => {
		expect(resolveRelationInterface("BelongsTo")).toBe("belongsTo");
	});

	it("returns 'belongsTo' for 'Belongsto' (mixed case)", () => {
		expect(resolveRelationInterface("Belongsto")).toBe("belongsTo");
	});

	it("returns 'belongsTo' for 'BELONGSTO' (uppercase)", () => {
		expect(resolveRelationInterface("BELONGSTO")).toBe("belongsTo");
	});

	it("returns 'o2m' for 'o2m' input", () => {
		expect(resolveRelationInterface("o2m")).toBe("o2m");
	});

	it("returns 'hasMany' for 'hasmany' (lowercase)", () => {
		expect(resolveRelationInterface("hasmany")).toBe("hasMany");
	});

	it("returns 'hasMany' for 'HasMany'", () => {
		expect(resolveRelationInterface("HasMany")).toBe("hasMany");
	});

	it("returns 'm2m' for 'm2m' input", () => {
		expect(resolveRelationInterface("m2m")).toBe("m2m");
	});

	it("returns 'manyToMany' for 'manytomany' (lowercase)", () => {
		expect(resolveRelationInterface("manytomany")).toBe("manyToMany");
	});

	it("returns 'manyToMany' for 'ManyToMany'", () => {
		expect(resolveRelationInterface("ManyToMany")).toBe("manyToMany");
	});

	it("returns 'oho' for 'oho' input", () => {
		expect(resolveRelationInterface("oho")).toBe("oho");
	});

	it("returns 'obo' for 'obo' input", () => {
		expect(resolveRelationInterface("obo")).toBe("obo");
	});

	it("returns 'mbm' for 'mbm' input", () => {
		expect(resolveRelationInterface("mbm")).toBe("mbm");
	});

	it("returns 'belongsToArray' for 'belongstoarray' (lowercase)", () => {
		expect(resolveRelationInterface("belongstoarray")).toBe("belongsToArray");
	});

	it("returns 'belongsToArray' for 'belongsToArray' (exact case)", () => {
		expect(resolveRelationInterface("belongsToArray")).toBe("belongsToArray");
	});

	it("returns 'm2m' for 'attachment' input", () => {
		expect(resolveRelationInterface("attachment")).toBe("m2m");
	});

	it("returns 'belongsTo' for 'createdby' (lowercase)", () => {
		expect(resolveRelationInterface("createdby")).toBe("belongsTo");
	});

	it("returns 'belongsTo' for 'createdBy' (camelCase)", () => {
		expect(resolveRelationInterface("createdBy")).toBe("belongsTo");
	});

	it("returns 'belongsTo' for 'updatedby' (lowercase)", () => {
		expect(resolveRelationInterface("updatedby")).toBe("belongsTo");
	});

	it("returns 'belongsTo' for 'updatedBy' (camelCase)", () => {
		expect(resolveRelationInterface("updatedBy")).toBe("belongsTo");
	});

	it("returns null for unknown values", () => {
		expect(resolveRelationInterface("unknown")).toBeNull();
	});

	it("returns null for random string", () => {
		expect(resolveRelationInterface("not-a-relation")).toBeNull();
	});

	it("trims whitespace before resolving", () => {
		expect(resolveRelationInterface("  m2o  ")).toBe("m2o");
	});

	it("trims whitespace and handles case for '  HasMany  '", () => {
		expect(resolveRelationInterface("  HasMany  ")).toBe("hasMany");
	});
});

describe("resolveRelationByType", () => {
	it("returns null for null input", () => {
		expect(resolveRelationByType(null)).toBeNull();
	});

	it("returns null for undefined input", () => {
		expect(resolveRelationByType(undefined)).toBeNull();
	});

	it("returns null for empty string", () => {
		expect(resolveRelationByType("")).toBeNull();
	});

	it("returns null for whitespace-only string", () => {
		expect(resolveRelationByType("   ")).toBeNull();
	});

	it("returns 'belongsTo' for 'belongsTo'", () => {
		expect(resolveRelationByType("belongsTo")).toBe("belongsTo");
	});

	it("returns 'm2m' for 'belongsToMany'", () => {
		expect(resolveRelationByType("belongsToMany")).toBe("m2m");
	});

	it("returns 'hasMany' for 'hasMany'", () => {
		expect(resolveRelationByType("hasMany")).toBe("hasMany");
	});

	it("returns 'hasOne' for 'hasOne'", () => {
		expect(resolveRelationByType("hasOne")).toBe("hasOne");
	});

	it("returns null for unknown relation types", () => {
		expect(resolveRelationByType("unknown")).toBeNull();
	});

	it("returns null for partial matches like 'belongs'", () => {
		expect(resolveRelationByType("belongs")).toBeNull();
	});

	it("returns null for 'm2o' (not in TYPE_MAP)", () => {
		expect(resolveRelationByType("m2o")).toBeNull();
	});
});

describe("getRelationCardinality", () => {
	describe('returns "one" for single-relation types', () => {
		it("m2o → one", () => {
			expect(getRelationCardinality("m2o")).toBe("one");
		});

		it("belongsTo → one", () => {
			expect(getRelationCardinality("belongsTo")).toBe("one");
		});

		it("oho → one", () => {
			expect(getRelationCardinality("oho")).toBe("one");
		});

		it("obo → one", () => {
			expect(getRelationCardinality("obo")).toBe("one");
		});

		it("hasOne → one", () => {
			expect(getRelationCardinality("hasOne")).toBe("one");
		});
	});

	describe('returns "many" for collection-relation types', () => {
		it("o2m → many", () => {
			expect(getRelationCardinality("o2m")).toBe("many");
		});

		it("hasMany → many", () => {
			expect(getRelationCardinality("hasMany")).toBe("many");
		});

		it("m2m → many", () => {
			expect(getRelationCardinality("m2m")).toBe("many");
		});

		it("manyToMany → many", () => {
			expect(getRelationCardinality("manyToMany")).toBe("many");
		});

		it("mbm → many", () => {
			expect(getRelationCardinality("mbm")).toBe("many");
		});

		it("belongsToArray → many", () => {
			expect(getRelationCardinality("belongsToArray")).toBe("many");
		});
	});
});

describe("renderRelationValueType", () => {
	it('renders "Target | null" for cardinality "one"', () => {
		const result = renderRelationValueType("users", "one");
		expect(result).toBe("Users | null");
	});

	it('renders "Target[]" for cardinality "many"', () => {
		const result = renderRelationValueType("users", "many");
		expect(result).toBe("Users[]");
	});

	it('renders "unknown | null" when target is empty string', () => {
		const result = renderRelationValueType("", "one");
		expect(result).toBe("unknown | null");
	});

	it('renders "unknown[]" when target is empty string and cardinality many', () => {
		const result = renderRelationValueType("", "many");
		expect(result).toBe("unknown[]");
	});

	it('renders "unknown | null" when target is whitespace only', () => {
		const result = renderRelationValueType("   ", "one");
		expect(result).toBe("unknown | null");
	});

	it('renders "unknown[]" when target is whitespace only and cardinality many', () => {
		const result = renderRelationValueType("   ", "many");
		expect(result).toBe("unknown[]");
	});

	it("applies prefix naming config", () => {
		const result = renderRelationValueType("users", "one", {
			prefix: "I",
		});
		expect(result).toBe("IUsers | null");
	});

	it("applies suffix naming config", () => {
		const result = renderRelationValueType("users", "one", {
			suffix: "Model",
		});
		expect(result).toBe("UsersModel | null");
	});

	it("applies both prefix and suffix naming config", () => {
		const result = renderRelationValueType("users", "one", {
			prefix: "I",
			suffix: "Model",
		});
		expect(result).toBe("IUsersModel | null");
	});

	it("handles kebab-case collection names", () => {
		const result = renderRelationValueType("order-items", "many");
		expect(result).toBe("OrderItems[]");
	});

	it("handles snake_case collection names", () => {
		const result = renderRelationValueType("order_items", "one");
		expect(result).toBe("OrderItems | null");
	});
});

describe("inferRelationFromFieldName", () => {
	it("infers belongsTo from id_* pattern", () => {
		expect(inferRelationFromFieldName("id_users")).toEqual({
			type: "belongsTo",
			targetCollection: "users",
		});
	});

	it("infers belongsTo from *_id pattern", () => {
		expect(inferRelationFromFieldName("department_id")).toEqual({
			type: "belongsTo",
			targetCollection: "department",
		});
	});

	it("returns null for blacklisted id fields", () => {
		expect(inferRelationFromFieldName("id")).toBeNull();
		expect(inferRelationFromFieldName("uuid")).toBeNull();
	});
});

describe("renderRelationZodType", () => {
	it("uses z.lazy with target base schema when relation target is available and external", () => {
		const result = renderRelationZodType(
			"users",
			"one",
			new Set(["users", "t_crm_troca_titularidade"]),
		);
		expect(result).toBe("z.lazy(() => usersBaseSchema.nullable())");
	});

	it("uses z.lazy with target base schema array when relation cardinality is many", () => {
		const result = renderRelationZodType(
			"users",
			"many",
			new Set(["users", "t_crm_troca_titularidade"]),
		);
		expect(result).toBe("z.lazy(() => usersBaseSchema.array())");
	});

	it("uses z.lazy with base schema for self-relation", () => {
		const result = renderRelationZodType("users", "one", new Set(["users"]));
		expect(result).toBe("z.lazy(() => usersBaseSchema.nullable())");
	});

	it("uses z.lazy with base schema array for self-relation many", () => {
		const result = renderRelationZodType("users", "many", new Set(["users"]));
		expect(result).toBe("z.lazy(() => usersBaseSchema.array())");
	});

	it("keeps primitive fallback when target collection is unavailable", () => {
		const result = renderRelationZodType(
			"users",
			"one",
			new Set(["t_crm_troca_titularidade"]),
		);
		expect(result).toBe("z.number().nullable()");
	});
});
