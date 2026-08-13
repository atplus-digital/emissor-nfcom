import type { ListrDefaultRendererOptions } from "listr2";

export type ListrLogLevel = "debug" | "info" | "warn" | "error" | (string & {});

/** Renderer Listr2: verbose em debug, default caso contrário. */
export function resolveListrRenderer(
	logLevel?: ListrLogLevel,
): "default" | "verbose" {
	return logLevel === "debug" ? "verbose" : "default";
}

/** Opções compartilhadas para manter subtasks e erros visíveis no terminal. */
export const DEFAULT_LISTR_RENDERER_OPTIONS = {
	lazy: false,
	collapseSkips: false,
	collapseErrors: false,
	collapseSubtasks: false,
} satisfies ListrDefaultRendererOptions;

export function createRootListrOptions(options?: {
	concurrent?: boolean;
	logLevel?: ListrLogLevel;
}): {
	concurrent: boolean;
	renderer: "default" | "verbose";
	rendererOptions: typeof DEFAULT_LISTR_RENDERER_OPTIONS;
} {
	return {
		concurrent: options?.concurrent ?? false,
		renderer: resolveListrRenderer(options?.logLevel),
		rendererOptions: DEFAULT_LISTR_RENDERER_OPTIONS,
	};
}
