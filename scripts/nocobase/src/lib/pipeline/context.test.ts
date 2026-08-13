import { describe, expect, it } from "vitest";
import type { PipelineExecutionContext } from "./context";
import { createReportsContext } from "./reports";

describe("TC-UT-CTX-001: PipelineExecutionContext has correct shape", () => {
	it("should have all required properties", () => {
		const reports = createReportsContext();
		const context: PipelineExecutionContext<string> = {
			tempDir: "/tmp/test",
			outputDirs: ["src/generated"],
			runtimeConfig: "{}",
			reports,
		};

		expect(context.tempDir).toBe("/tmp/test");
		expect(context.outputDirs).toEqual(["src/generated"]);
		expect(context.runtimeConfig).toBe("{}");
		expect(context.reports).toBeDefined();
		expect(context.reports.schemaVersion).toBe(1);
	});
});

describe("TC-UT-CTX-002: PipelineExecutionContext accepts optional properties", () => {
	it("should allow optional overrideConfig", () => {
		const reports = createReportsContext();
		const context: PipelineExecutionContext<{ foo: string }> = {
			tempDir: "/tmp/test",
			outputDirs: ["src/generated"],
			runtimeConfig: { foo: "baz" },
			overrideConfig: { foo: "bar" },
			reports,
		};

		expect(context.overrideConfig).toEqual({ foo: "bar" });
	});

	it("should allow optional pipelineContext", () => {
		const reports = createReportsContext();
		const context: PipelineExecutionContext<string, { stage: number }> = {
			tempDir: "/tmp/test",
			outputDirs: ["src/generated"],
			runtimeConfig: "{}",
			pipelineContext: { stage: 1 },
			reports,
		};

		expect(context.pipelineContext).toEqual({ stage: 1 });
	});

	it("should allow optional finalResult", () => {
		const reports = createReportsContext();
		const context: PipelineExecutionContext<string> = {
			tempDir: "/tmp/test",
			outputDirs: ["src/generated"],
			runtimeConfig: "{}",
			finalResult: { success: true },
			reports,
		};

		expect(context.finalResult).toEqual({ success: true });
	});
});

describe("TC-UT-CTX-003: Context tempDir uniqueness for different runs", () => {
	it("should allow different tempDirs for different context instances", () => {
		const reports = createReportsContext();

		const context1: PipelineExecutionContext<string> = {
			tempDir: "/tmp/run1/temp",
			outputDirs: ["src/generated"],
			runtimeConfig: "{}",
			reports,
		};

		const context2: PipelineExecutionContext<string> = {
			tempDir: "/tmp/run2/temp",
			outputDirs: ["src/generated"],
			runtimeConfig: "{}",
			reports,
		};

		expect(context1.tempDir).not.toBe(context2.tempDir);
	});
});

describe("TC-UT-CTX-004: Context with multiple outputDirs", () => {
	it("should support multiple output directories", () => {
		const reports = createReportsContext();
		const context: PipelineExecutionContext<string> = {
			tempDir: "/tmp/test",
			outputDirs: ["src/generated/nocobase", "src/generated/ixc"],
			runtimeConfig: "{}",
			reports,
		};

		expect(context.outputDirs).toHaveLength(2);
	});
});
