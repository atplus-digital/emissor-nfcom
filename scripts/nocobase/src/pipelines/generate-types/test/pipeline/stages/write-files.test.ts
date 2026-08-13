import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { writeFilesStage } from "@generators/pipelines/generate-types/stages/write-files";
import { afterEach, describe, expect, it } from "vitest";
import { createMockTask, createPipelineContext } from "../../helpers";

describe("writeFilesStage", () => {
	const tempDirs: string[] = [];

	afterEach(() => {
		for (const dir of tempDirs) {
			fs.rmSync(dir, { recursive: true, force: true });
		}
		tempDirs.length = 0;
	});

	it("writes generated files to the output directory", async () => {
		const outputDir = fs.mkdtempSync(
			path.join(os.tmpdir(), "gen-types-write-"),
		);
		tempDirs.push(outputDir);

		const context = createPipelineContext({
			runtimeConfig: { outputDir },
			pipelineContext: {
				fileContents: new Map([["index.ts", "export const X = 1;\n"]]),
			},
		});

		const result = await writeFilesStage(context, createMockTask());
		const writtenPath = path.join(outputDir, "index.ts");

		expect(fs.existsSync(writtenPath)).toBe(true);
		expect(fs.readFileSync(writtenPath, "utf-8")).toBe("export const X = 1;\n");
		expect(result.pipelineContext?.writeResults?.[0]?.changed).toBe(true);
	});

	it("skips write when content is unchanged", async () => {
		const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "gen-types-skip-"));
		tempDirs.push(outputDir);
		const filePath = path.join(outputDir, "same.ts");
		fs.mkdirSync(outputDir, { recursive: true });
		fs.writeFileSync(filePath, "unchanged\n", "utf-8");

		const context = createPipelineContext({
			runtimeConfig: { outputDir },
			pipelineContext: {
				fileContents: new Map([["same.ts", "unchanged\n"]]),
			},
		});

		const result = await writeFilesStage(context, createMockTask());

		expect(result.pipelineContext?.writeResults?.[0]?.changed).toBe(false);
	});

	it("throws when fileContents is missing", async () => {
		const context = createPipelineContext({ pipelineContext: {} });

		await expect(writeFilesStage(context, createMockTask())).rejects.toThrow(
			"fileContents não encontrado",
		);
	});
});
