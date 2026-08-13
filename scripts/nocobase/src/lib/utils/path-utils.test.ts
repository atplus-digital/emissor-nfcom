import { describe, expect, it } from "vitest";
import { toDataSourceOutputFolder, toSafePathSegment } from "./path-utils";

describe("path-utils", () => {
	describe("toSafePathSegment", () => {
		it("TC-UT-PATH-001: replaces spaces with hyphens", () => {
			expect(toSafePathSegment("hello world")).toBe("hello-world");
		});

		it("TC-UT-PATH-002: replaces special characters with hyphens", () => {
			expect(toSafePathSegment("hello@world!")).toBe("hello-world-");
		});

		it("TC-UT-PATH-003: keeps alphanumeric, underscore, and hyphen", () => {
			expect(toSafePathSegment("hello_world-test123")).toBe(
				"hello_world-test123",
			);
		});

		it("TC-UT-PATH-004: handles empty string", () => {
			expect(toSafePathSegment("")).toBe("");
		});

		it("TC-UT-PATH-005: handles string with only special chars", () => {
			// Each special char becomes a hyphen: @#$% -> ----
			expect(toSafePathSegment("@#$%")).toBe("----");
		});
	});

	describe("toDataSourceOutputFolder", () => {
		it("TC-UT-PATH-006: maps 'main' to 'nocobase'", () => {
			expect(toDataSourceOutputFolder("main")).toBe("nocobase");
		});

		it("TC-UT-PATH-007: maps 'nocobase' to 'nocobase'", () => {
			expect(toDataSourceOutputFolder("nocobase")).toBe("nocobase");
		});

		it("TC-UT-PATH-008: maps 'ixc' to 'ixc'", () => {
			expect(toDataSourceOutputFolder("ixc")).toBe("ixc");
		});

		it("TC-UT-PATH-009: sanitizes unknown datasource key", () => {
			expect(toDataSourceOutputFolder("my-data-source")).toBe("my-data-source");
		});

		it("TC-UT-PATH-010: sanitizes datasource with spaces", () => {
			expect(toDataSourceOutputFolder("my data source")).toBe("my-data-source");
		});

		it("TC-UT-PATH-011: sanitizes datasource with special chars", () => {
			expect(toDataSourceOutputFolder("data@source!")).toBe("data-source-");
		});
	});
});
