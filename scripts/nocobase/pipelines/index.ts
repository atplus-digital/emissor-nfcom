import type { GeneratorPipeline } from "@generators/pipeline/types";
import { generateTypesPipeline } from "./generate-types";

/**
 * Pipelines registered with the CLI (`bun run generate:types`).
 * Adding a second pipeline = new folder here + one entry in this array.
 */
export const PIPELINES: GeneratorPipeline[] = [generateTypesPipeline];
