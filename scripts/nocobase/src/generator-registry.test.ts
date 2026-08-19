import { describe, expect, it, vi, mock } from "bun:test";

mock.module("@shared/utils/env", () => ({
	env: {
		VITE_LOG_LEVEL: "info",
	},
	resolveNocoBaseEnv: vi.fn(() => ({
		baseUrl: "https://nocobase.test/api",
		token: "token",
		timeoutMs: 5000,
		logLevel: "silent",
	})),
}));

import { GENERATOR_REGISTRY } from "./generator-registry";

describe("generator-registry", () => {
	it("registers all generator flags with definitions", () => {
		expect(GENERATOR_REGISTRY.map((entry) => entry.flag)).toEqual(["--types"]);
	});

	it("marks all generators as default runners", () => {
		for (const entry of GENERATOR_REGISTRY) {
			expect(entry.runInDefault).toBe(true);
		}
	});

	it("provides runnable definitions with expected names", () => {
		expect(GENERATOR_REGISTRY[0].definition.name).toBe("generate-types");
	});

	it("declares output directories for each generator", () => {
		expect(GENERATOR_REGISTRY[0].definition.getOutputDirs({})).toContain(
			"packages/generated/types",
		);
	});
});
