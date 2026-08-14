import {
	extractRelationInfo,
	mapFieldType,
} from "@generators/pipelines/generate-types/content/field-mapper";
import { createMockField } from "@generators/pipelines/generate-types/test/factories";
import { describe, expect, it } from "bun:test";

describe("mapFieldType", () => {
	describe("context fields", () => {
		it("should return 'unknown' for createdById when field type/interface is context", () => {
			const field = createMockField({
				name: "createdById",
				type: "context",
				interface: "context",
			});
			expect(mapFieldType(field)).toBe("unknown");
		});

		it("should return 'unknown' for updatedById when field type/interface is context", () => {
			const field = createMockField({
				name: "updatedById",
				type: "context",
				interface: "context",
			});
			expect(mapFieldType(field)).toBe("unknown");
		});

		it("should treat other context fields the same way", () => {
			const field = createMockField({
				name: "otherField",
				type: "context",
				interface: "context",
			});
			expect(mapFieldType(field)).toBe("unknown");
		});
	});

	describe("special interface handling", () => {
		it("should return 'unknown' for 'context' interface", () => {
			const field = createMockField({
				name: "customField",
				type: "string",
				interface: "context",
			});
			expect(mapFieldType(field)).toBe("unknown");
		});

		it("should return 'unknown' for 'context' type", () => {
			const field = createMockField({
				name: "customField",
				type: "context",
				interface: "input",
			});
			expect(mapFieldType(field)).toBe("unknown");
		});

		it("should return 'unknown[]' for 'set' interface", () => {
			const field = createMockField({
				name: "customField",
				type: "string",
				interface: "set",
			});
			expect(mapFieldType(field)).toBe("unknown[]");
		});

		it("should return 'unknown' when both interface and type are 'context'", () => {
			const field = createMockField({
				name: "customField",
				type: "context",
				interface: "context",
			});
			expect(mapFieldType(field)).toBe("unknown");
		});
	});

	describe("FIELD_TYPE_MAP entries", () => {
		it("should map 'array' type to 'string[]'", () => {
			const field = createMockField({ type: "array" });
			expect(mapFieldType(field)).toBe("string[]");
		});

		it("should map 'boolean' type to 'boolean'", () => {
			const field = createMockField({ type: "boolean" });
			expect(mapFieldType(field)).toBe("boolean");
		});

		it("should map 'date' type to 'string'", () => {
			const field = createMockField({ type: "date" });
			expect(mapFieldType(field)).toBe("string");
		});

		it("should map 'dateOnly' type to 'string'", () => {
			const field = createMockField({ type: "dateOnly" });
			expect(mapFieldType(field)).toBe("string");
		});

		it("should map 'datetime' type to 'string'", () => {
			const field = createMockField({ type: "datetime" });
			expect(mapFieldType(field)).toBe("string");
		});

		it("should map 'month' type to 'string'", () => {
			const field = createMockField({ type: "month" });
			expect(mapFieldType(field)).toBe("string");
		});

		it("should map 'time' type to 'string'", () => {
			const field = createMockField({ type: "time" });
			expect(mapFieldType(field)).toBe("string");
		});

		it("should map 'year' type to 'string'", () => {
			const field = createMockField({ type: "year" });
			expect(mapFieldType(field)).toBe("string");
		});

		it("should map 'bigInt' type to 'number'", () => {
			const field = createMockField({ type: "bigInt" });
			expect(mapFieldType(field)).toBe("number");
		});

		it("should map 'decimal' type to 'number'", () => {
			const field = createMockField({ type: "decimal" });
			expect(mapFieldType(field)).toBe("number");
		});

		it("should map 'double' type to 'number'", () => {
			const field = createMockField({ type: "double" });
			expect(mapFieldType(field)).toBe("number");
		});

		it("should map 'float' type to 'number'", () => {
			const field = createMockField({ type: "float" });
			expect(mapFieldType(field)).toBe("number");
		});

		it("should map 'integer' type to 'number'", () => {
			const field = createMockField({ type: "integer" });
			expect(mapFieldType(field)).toBe("number");
		});

		it("should map 'sort' type to 'number'", () => {
			const field = createMockField({ type: "sort" });
			expect(mapFieldType(field)).toBe("number");
		});

		it("should map 'timestamp' type to 'number'", () => {
			const field = createMockField({ type: "timestamp" });
			expect(mapFieldType(field)).toBe("number");
		});

		it("should map 'json' type to 'Record<string, unknown>'", () => {
			const field = createMockField({ type: "json" });
			expect(mapFieldType(field)).toBe("Record<string, unknown>");
		});

		it("should map 'jsonb' type to 'Record<string, unknown>'", () => {
			const field = createMockField({ type: "jsonb" });
			expect(mapFieldType(field)).toBe("Record<string, unknown>");
		});

		it("should map 'object' type to 'Record<string, unknown>'", () => {
			const field = createMockField({ type: "object" });
			expect(mapFieldType(field)).toBe("Record<string, unknown>");
		});

		it("should map 'set' type to 'unknown[]'", () => {
			const field = createMockField({ type: "set" });
			expect(mapFieldType(field)).toBe("unknown[]");
		});

		it("should map 'email' type to 'string'", () => {
			const field = createMockField({ type: "email" });
			expect(mapFieldType(field)).toBe("string");
		});

		it("should map 'formula' type to 'string'", () => {
			const field = createMockField({ type: "formula" });
			expect(mapFieldType(field)).toBe("string");
		});

		it("should map 'ipv4' type to 'string'", () => {
			const field = createMockField({ type: "ipv4" });
			expect(mapFieldType(field)).toBe("string");
		});

		it("should map 'ipv6' type to 'string'", () => {
			const field = createMockField({ type: "ipv6" });
			expect(mapFieldType(field)).toBe("string");
		});

		it("should map 'lineString' type to 'string'", () => {
			const field = createMockField({ type: "lineString" });
			expect(mapFieldType(field)).toBe("string");
		});

		it("should map 'movedTo' type to 'string'", () => {
			const field = createMockField({ type: "movedTo" });
			expect(mapFieldType(field)).toBe("string");
		});

		it("should map 'nanoid' type to 'string'", () => {
			const field = createMockField({ type: "nanoid" });
			expect(mapFieldType(field)).toBe("string");
		});

		it("should map 'password' type to 'string'", () => {
			const field = createMockField({ type: "password" });
			expect(mapFieldType(field)).toBe("string");
		});

		it("should map 'phone' type to 'string'", () => {
			const field = createMockField({ type: "phone" });
			expect(mapFieldType(field)).toBe("string");
		});

		it("should map 'point' type to 'string'", () => {
			const field = createMockField({ type: "point" });
			expect(mapFieldType(field)).toBe("string");
		});

		it("should map 'sequence' type to 'string'", () => {
			const field = createMockField({ type: "sequence" });
			expect(mapFieldType(field)).toBe("string");
		});

		it("should map 'snowflakeId' type to 'number'", () => {
			const field = createMockField({ type: "snowflakeId" });
			expect(mapFieldType(field)).toBe("number");
		});

		it("should map 'string' type to 'string'", () => {
			const field = createMockField({ type: "string" });
			expect(mapFieldType(field)).toBe("string");
		});

		it("should map 'text' type to 'string'", () => {
			const field = createMockField({ type: "text" });
			expect(mapFieldType(field)).toBe("string");
		});

		it("should map 'uid' type to 'string'", () => {
			const field = createMockField({ type: "uid" });
			expect(mapFieldType(field)).toBe("string");
		});

		it("should map 'url' type to 'string'", () => {
			const field = createMockField({ type: "url" });
			expect(mapFieldType(field)).toBe("string");
		});
	});

	describe("unknown types", () => {
		it("should return 'unknown' for unmapped type", () => {
			const field = createMockField({ type: "unmappedType" });
			expect(mapFieldType(field)).toBe("unknown");
		});

		it("should return 'unknown' for null type", () => {
			const field = createMockField({ type: null as unknown as string });
			expect(mapFieldType(field)).toBe("unknown");
		});

		it("should return 'unknown' for undefined type", () => {
			const field = createMockField({ type: undefined as unknown as string });
			expect(mapFieldType(field)).toBe("unknown");
		});
	});
});

describe("extractRelationInfo", () => {
	describe("context scalar fields are not relations", () => {
		it("should return null for createdById field", () => {
			const field = createMockField({
				name: "createdById",
				type: "context",
				interface: "context",
				target: "users",
			});
			expect(extractRelationInfo(field)).toBeNull();
		});

		it("should return null for updatedById field", () => {
			const field = createMockField({
				name: "updatedById",
				type: "context",
				interface: "context",
				target: "users",
			});
			expect(extractRelationInfo(field)).toBeNull();
		});
	});

	describe("relation interface resolution", () => {
		it("should resolve 'm2o' interface to m2o relation", () => {
			const field = createMockField({
				name: "author",
				type: "belongsTo",
				interface: "m2o",
				target: "users",
			});
			const result = extractRelationInfo(field);
			expect(result).toEqual({
				type: "m2o",
				targetCollection: "users",
			});
		});

		it("should resolve 'belongsTo' interface to belongsTo relation", () => {
			const field = createMockField({
				name: "category",
				type: "belongsTo",
				interface: "belongsTo",
				target: "categories",
			});
			const result = extractRelationInfo(field);
			expect(result).toEqual({
				type: "belongsTo",
				targetCollection: "categories",
			});
		});

		it("should resolve 'o2m' interface to o2m relation", () => {
			const field = createMockField({
				name: "posts",
				type: "hasMany",
				interface: "o2m",
				target: "posts",
			});
			const result = extractRelationInfo(field);
			expect(result).toEqual({
				type: "o2m",
				targetCollection: "posts",
			});
		});

		it("should resolve 'hasMany' interface to hasMany relation", () => {
			const field = createMockField({
				name: "comments",
				type: "hasMany",
				interface: "hasMany",
				target: "comments",
			});
			const result = extractRelationInfo(field);
			expect(result).toEqual({
				type: "hasMany",
				targetCollection: "comments",
			});
		});

		it("should resolve 'm2m' interface to m2m relation", () => {
			const field = createMockField({
				name: "tags",
				type: "belongsToMany",
				interface: "m2m",
				target: "tags",
			});
			const result = extractRelationInfo(field);
			expect(result).toEqual({
				type: "m2m",
				targetCollection: "tags",
			});
		});

		it("should preserve empty target", () => {
			const field = createMockField({
				name: "orphanField",
				type: "belongsTo",
				interface: "m2o",
				target: "",
			});
			const result = extractRelationInfo(field);
			expect(result).toEqual({
				type: "m2o",
				targetCollection: "",
			});
		});

		it("should not inject default target for createdBy when target is missing", () => {
			const field = createMockField({
				name: "createdBy",
				type: "belongsTo",
				interface: "createdBy",
			});
			const result = extractRelationInfo(field);
			expect(result).toEqual({
				type: "belongsTo",
				targetCollection: "",
			});
		});
	});

	describe("fallback to field.type", () => {
		it("should fall back to 'belongsTo' type when interface is null", () => {
			const field = createMockField({
				name: "author",
				type: "belongsTo",
				interface: null,
				target: "users",
			});
			const result = extractRelationInfo(field);
			expect(result).toEqual({
				type: "belongsTo",
				targetCollection: "users",
			});
		});

		it("should fall back to 'belongsToMany' type when interface is null", () => {
			const field = createMockField({
				name: "roles",
				type: "belongsToMany",
				interface: null,
				target: "roles",
			});
			const result = extractRelationInfo(field);
			expect(result).toEqual({
				type: "m2m",
				targetCollection: "roles",
			});
		});

		it("should fall back to 'hasMany' type when interface is null", () => {
			const field = createMockField({
				name: "posts",
				type: "hasMany",
				interface: null,
				target: "posts",
			});
			const result = extractRelationInfo(field);
			expect(result).toEqual({
				type: "hasMany",
				targetCollection: "posts",
			});
		});

		it("should fall back to 'hasOne' type when interface is null", () => {
			const field = createMockField({
				name: "profile",
				type: "hasOne",
				interface: null,
				target: "profiles",
			});
			const result = extractRelationInfo(field);
			expect(result).toEqual({
				type: "hasOne",
				targetCollection: "profiles",
			});
		});

		it("should fall back to 'belongsToArray' type when interface is null", () => {
			const field = createMockField({
				name: "items",
				type: "belongsToArray",
				interface: null,
				target: "items",
			});
			const result = extractRelationInfo(field);
			expect(result).toEqual({
				type: "belongsToArray",
				targetCollection: "items",
			});
		});
	});

	describe("non-relation fields", () => {
		it("should return null when interface is null and type is not a relation", () => {
			const field = createMockField({
				name: "title",
				type: "string",
				interface: null,
				target: undefined,
			});
			expect(extractRelationInfo(field)).toBeNull();
		});

		it("should return null for regular scalar field with input interface", () => {
			const field = createMockField({
				name: "name",
				type: "string",
				interface: "input",
			});
			expect(extractRelationInfo(field)).toBeNull();
		});

		it("should return null for number field with number interface", () => {
			const field = createMockField({
				name: "count",
				type: "integer",
				interface: "number",
			});
			expect(extractRelationInfo(field)).toBeNull();
		});

		it("should return null when both interface and type indicate no relation", () => {
			const field = createMockField({
				name: "description",
				type: "text",
				interface: "textarea",
				target: undefined,
			});
			expect(extractRelationInfo(field)).toBeNull();
		});
	});
});
