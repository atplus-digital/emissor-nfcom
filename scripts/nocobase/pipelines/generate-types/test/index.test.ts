import { describe, expect, it } from "bun:test";

describe("index.ts - entry point", () => {
	it("exports the generateTypesPipeline object", async () => {
		const indexModule = await import("@pipelines/generate-types/index");
		const pipeline = indexModule.generateTypesPipeline;
		expect(pipeline).toBeDefined();
		expect(pipeline.name).toBe("generate-types");
		expect(pipeline.flag).toBe("--types");
		expect(pipeline.runInDefault).toBe(true);
		expect(Array.isArray(pipeline.outputDirs)).toBe(true);
		expect(pipeline.buildStages()).toHaveLength(1);
	});
});
