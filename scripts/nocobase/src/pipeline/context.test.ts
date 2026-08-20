import { describe, expect, it } from "bun:test";
import type { PipelineExecutionContext } from "./context";

describe("TC-UT-CTX-001: PipelineExecutionContext has correct shape", () => {
	it("should have all required properties", () => {
		const context: PipelineExecutionContext = {
			tempDir: "/tmp/test",
			outputDirs: ["packages/generated"],
		};

		expect(context.tempDir).toBe("/tmp/test");
		expect(context.outputDirs).toEqual(["packages/generated"]);
	});
});

describe("TC-UT-CTX-002: PipelineExecutionContext accepts optional properties", () => {
	it("should allow optional pipelineContext", () => {
		const context: PipelineExecutionContext = {
			tempDir: "/tmp/test",
			outputDirs: ["packages/generated"],
			pipelineContext: { stage: 1 },
		};

		expect(context.pipelineContext).toEqual({ stage: 1 });
	});
});

describe("TC-UT-CTX-003: Context tempDir uniqueness for different runs", () => {
	it("should allow different tempDirs for different context instances", () => {
		const context1: PipelineExecutionContext = {
			tempDir: "/tmp/run1/temp",
			outputDirs: ["packages/generated"],
		};

		const context2: PipelineExecutionContext = {
			tempDir: "/tmp/run2/temp",
			outputDirs: ["packages/generated"],
		};

		expect(context1.tempDir).not.toBe(context2.tempDir);
	});
});

describe("TC-UT-CTX-004: Context with multiple outputDirs", () => {
	it("should support multiple output directories", () => {
		const context: PipelineExecutionContext = {
			tempDir: "/tmp/test",
			outputDirs: ["packages/generated/nocobase", "packages/generated/ixc"],
		};

		expect(context.outputDirs).toHaveLength(2);
	});
});
