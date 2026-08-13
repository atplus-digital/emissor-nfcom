import {
	formatKey,
	removeAccents,
	resolveBaseInterfaceNamingConfig,
	toCollectionBaseTypeName,
	toCollectionConstantPrefix,
	toCollectionTypeName,
	toFileName,
	toScreamingSnakeCase,
	toValidIdentifier,
} from "@generators/pipelines/generate-types/utils/naming";
import { describe, expect, it } from "vitest";

describe("naming utilities", () => {
	describe("removeAccents", () => {
		it("removes diacritics", () => {
			expect(removeAccents("São Paulo")).toBe("Sao Paulo");
		});
	});

	describe("toValidIdentifier", () => {
		it("returns underscore for empty input", () => {
			expect(toValidIdentifier("")).toBe("_");
		});

		it("prefixes with underscore when starting with number", () => {
			expect(toValidIdentifier("123abc")).toBe("_123abc");
		});

		it("replaces special characters with underscore", () => {
			expect(toValidIdentifier("my-var")).toBe("my_var");
			expect(toValidIdentifier("user@email")).toBe("user_email");
		});

		it("preserves valid identifiers", () => {
			expect(toValidIdentifier("userId")).toBe("userId");
			expect(toValidIdentifier("_private")).toBe("_private");
		});
	});

	describe("formatKey", () => {
		it("returns identifier without quotes for valid identifiers", () => {
			expect(formatKey("userId")).toBe("userId");
		});

		it("returns quoted string for invalid identifiers", () => {
			expect(formatKey("user-id")).toBe('"user-id"');
			expect(formatKey("123")).toBe('"123"');
		});
	});

	describe("toCollectionTypeName", () => {
		it("converts normal collection names", () => {
			expect(toCollectionTypeName("users")).toBe("Users");
		});

		it("removes t_ prefix", () => {
			expect(toCollectionTypeName("t_negociacoes")).toBe("Negociacoes");
		});

		it("handles hyphenated names", () => {
			expect(toCollectionTypeName("user-roles")).toBe("UserRoles");
		});
	});

	describe("toCollectionBaseTypeName", () => {
		it("applies default suffix when configured", () => {
			expect(toCollectionBaseTypeName("users")).toBe("Users");
			expect(toCollectionBaseTypeName("users", { suffix: "Base" })).toBe(
				"UsersBase",
			);
		});

		it("returns sentinel for empty string", () => {
			expect(toCollectionBaseTypeName("")).toBe("__UnnamedCollection__");
		});

		it("applies custom prefix and suffix", () => {
			expect(
				toCollectionBaseTypeName("users", { prefix: "I", suffix: "Entity" }),
			).toBe("IUsersEntity");
		});

		it("applies no prefix and no suffix", () => {
			expect(
				toCollectionBaseTypeName("users", { prefix: "", suffix: "" }),
			).toBe("Users");
		});
	});

	describe("toFileName", () => {
		it("removes t_ and f_ prefixes", () => {
			expect(toFileName("t_negociacoes")).toBe("negociacoes");
			expect(toFileName("f_funcionarios")).toBe("funcionarios");
		});

		it("converts underscores to kebab-case", () => {
			expect(toFileName("user_roles")).toBe("user-roles");
		});
	});

	describe("toScreamingSnakeCase", () => {
		it("converts camelCase and spaces", () => {
			expect(toScreamingSnakeCase("grauSatisfacao")).toBe("GRAU_SATISFACAO");
		});

		it("returns UNKNOWN for empty result", () => {
			expect(toScreamingSnakeCase("   ")).toBe("UNKNOWN");
		});
	});

	describe("toCollectionConstantPrefix", () => {
		it("strips t_ prefix before screaming snake", () => {
			expect(toCollectionConstantPrefix("t_pessoas")).toBe("PESSOAS");
		});
	});

	describe("resolveBaseInterfaceNamingConfig", () => {
		it("returns defaults when undefined", () => {
			expect(resolveBaseInterfaceNamingConfig(undefined)).toEqual({
				prefix: "",
				suffix: "",
			});
		});

		it("overrides prefix and suffix", () => {
			expect(
				resolveBaseInterfaceNamingConfig({
					prefix: "I",
					suffix: "Interface",
				}),
			).toEqual({ prefix: "I", suffix: "Interface" });
		});
	});
});
