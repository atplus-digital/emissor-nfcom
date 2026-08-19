import type { GeneratorDefinition } from "@generators/lib/types";
import {
	createScriptTasks,
	type RunGeneratorCliOptions,
} from "./lib/pipeline/create-script-definition";
import { createGenerateTypesPipeline } from "./pipelines/generate-types/pipeline";

type GeneratorRegistryEntry<TFlag extends string = string> = {
	flag: TFlag;
	runInDefault?: boolean;
	definition: GeneratorDefinition;
};

export type CreateScriptTasksInput<TContext = unknown> = {
	description: string;
	outputDirs: string[];
	createCliOptions: () => RunGeneratorCliOptions<TContext>;
};

const GENERATOR_REGISTRY = [
	{
		flag: "--types",
		runInDefault: true,
		definition: createScriptTasks({
			description: "Generate TypeScript types from NocoBase and IXC schemas",
			outputDirs: ["packages/generated/types"],
			createCliOptions: createGenerateTypesPipeline,
		}),
	},
] as const satisfies readonly GeneratorRegistryEntry[];

export { GENERATOR_REGISTRY };
