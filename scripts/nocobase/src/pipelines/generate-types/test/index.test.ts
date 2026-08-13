import { describe, expect, it, vi } from "vitest";

vi.mock("@shared/utils/env", () => ({
	resolveNocoBaseEnv: vi.fn(() => ({
		baseUrl: "https://example.com/api",
		token: "test-token",
		timeoutMs: 30_000,
	})),
}));

describe("index.ts - entry point", () => {
	it("exports createGenerateTypesPipeline", async () => {
		const indexModule = await import(
			"@generators/pipelines/generate-types/index"
		);
		expect(indexModule.createGenerateTypesPipeline).toBeTypeOf("function");
	});
});
