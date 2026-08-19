import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { buildTypes } from "@generators/pipelines/generate-types/stages/build-types";
import { fetchSchemas } from "@generators/pipelines/generate-types/stages/fetch-schemas";
import { generateContentStage } from "@generators/pipelines/generate-types/stages/generate-content";
import { writeFilesStage } from "@generators/pipelines/generate-types/stages/write-files";
import { afterEach, describe, expect, it, vi } from "bun:test";
import { createMockField } from "../factories";
import { createMockTask, createPipelineContext } from "../helpers";

describe("generate-types stage integration", () => {
	const tempDirs: string[] = [];

	afterEach(() => {
		for (const dir of tempDirs) {
			fs.rmSync(dir, { recursive: true, force: true });
		}
		tempDirs.length = 0;
	});

	it("runs fetch → build → content → write end-to-end", async () => {
		const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "gt-integration-"));
		tempDirs.push(outputDir);

		const fetchCollections = vi.fn().mockResolvedValue([
			{
				name: "users",
				fields: [
					createMockField({ name: "id", type: "integer", interface: "id" }),
					createMockField({ name: "name", type: "string" }),
				],
			},
			{
				name: "t_orders",
				fields: [
					createMockField({
						name: "f_user",
						type: "belongsTo",
						interface: "m2o",
						target: "users",
					}),
				],
			},
		]);

		let context = createPipelineContext({
			runtimeConfig: {
				outputDir,
				collections: [],
				splitCollections: ["t_orders"],
				includeDependents: true,
			},
			pipelineContext: {
				client: { baseUrl: "http://localhost", fetchCollections },
			},
		});

		context = await fetchSchemas(context, createMockTask());
		context = await buildTypes(context, createMockTask());
		context = await generateContentStage(context, createMockTask());
		context = await writeFilesStage(context, createMockTask());

		expect(context.pipelineContext?.writeResults?.length).toBeGreaterThan(0);
		expect(fs.existsSync(path.join(outputDir, "collections.ts"))).toBe(true);
		expect(fs.existsSync(path.join(outputDir, "orders", "schemas.ts"))).toBe(
			true,
		);
		expect(
			fs.existsSync(path.join(outputDir, "other", "users", "index.ts")),
		).toBe(true);
	});
});
