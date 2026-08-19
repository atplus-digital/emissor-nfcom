import { describe, expect, it } from "bun:test";
import type { PipelineExecutionContext } from "./context";

describe("TC-UT-CTX-001: PipelineExecutionContext has correct shape", () => {
	it("should have all required properties", () => {
		const context: PipelineExecutionContext<string> = {
			tempDir: "/tmp/test",
			outputDirs: ["packages/generated"],
			runtimeConfig: "{}",
		};

		expect(context.tempDir).toBe("/tmp/test");
		expect(context.outputDirs).toEqual(["packages/generated"]);
		expect(context.runtimeConfig).toBe("{}");
	});
});

describe("TC-UT-CTX-002: PipelineExecutionContext accepts optional properties", () => {
	it("should allow optional overrideConfig", () => {
		const context: PipelineExecutionContext<{ foo: string }> = {
			tempDir: "/tmp/test",
			outputDirs: ["packages/generated"],
			runtimeConfig: { foo: "baz" },
			overrideConfig: { foo: "bar" },
		};

		expect(context.overrideConfig).toEqual({ foo: "bar" });
	});

	it("should allow optional pipelineContext", () => {
		const context: PipelineExecutionContext<string, { stage: number }> = {
			tempDir: "/tmp/test",
			outputDirs: ["packages/generated"],
			runtimeConfig: "{}",
			pipelineContext: { stage: 1 },
		};

		expect(context.pipelineContext).toEqual({ stage: 1 });
	});

	it("should allow optional finalResult", () => {
		const context: PipelineExecutionContext<string> = {
			tempDir: "/tmp/test",
			outputDirs: ["packages/generated"],
			runtimeConfig: "{}",
			finalResult: { success: true },
		};

		expect(context.finalResult).toEqual({ success: true });
	});
});

describe("TC-UT-CTX-003: Context tempDir uniqueness for different runs", () => {
	it("should allow different tempDirs for different context instances", () => {
		const context1: PipelineExecutionContext<string> = {
			tempDir: "/tmp/run1/temp",
			outputDirs: ["packages/generated"],
			runtimeConfig: "{}",
		};

		const context2: PipelineExecutionContext<string> = {
			tempDir: "/tmp/run2/temp",
			outputDirs: ["packages/generated"],
			runtimeConfig: "{}",
		};

		expect(context1.tempDir).not.toBe(context2.tempDir);
	});
});

describe("TC-UT-CTX-004: Context with multiple outputDirs", () => {
	it("should support multiple output directories", () => {
		const context: PipelineExecutionContext<string> = {
			tempDir: "/tmp/test",
			outputDirs: ["packages/generated/nocobase", "packages/generated/ixc"],
			runtimeConfig: "{}",
		};

		expect(context.outputDirs).toHaveLength(2);
	});
});
