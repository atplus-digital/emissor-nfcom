import { describe, expect, it } from "bun:test";
import {
	formatKey,
	removeAccents,
	resolveBaseInterfaceNamingConfig,
	toBaseSchemaName,
	toCollectionBaseTypeName,
	toCollectionConstantPrefix,
	toCollectionTypeName,
	toFileName,
	toScreamingSnakeCase,
	toValidIdentifier,
} from "@pipelines/generate-types/utils/naming";

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

	describe("toBaseSchemaName", () => {
		it("derives from real API name with t_ prefix", () => {
			expect(toBaseSchemaName("t_linhas_fixas")).toBe("linhas_fixasBaseSchema");
		});

		it("derives from slug kebab (pasta) producing valid identifier", () => {
			// toFileName("t_linhas_fixas") === "linhas-fixas" — slug deve normalizar
			// hífens para underscore e gerar identificador TS válido.
			expect(toBaseSchemaName("linhas-fixas")).toBe("linhas_fixasBaseSchema");
		});

		it("derives from underscore name without t_ prefix", () => {
			expect(toBaseSchemaName("cliente_contrato")).toBe(
				"cliente_contratoBaseSchema",
			);
		});

		it("handles plain name without prefix", () => {
			expect(toBaseSchemaName("users")).toBe("usersBaseSchema");
		});

		it("preserves f_ prefix (field prefix, not table prefix)", () => {
			// `f_` é prefixo de campo, não de collection — não deve ser removido,
			// senão colapsa com a collection sem prefixo.
			expect(toBaseSchemaName("f_funcionarios")).toBe(
				"f_funcionariosBaseSchema",
			);
		});

		it("prefixes with underscore when name starts with digit", () => {
			expect(toBaseSchemaName("t_123abc")).toBe("_123abcBaseSchema");
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
