import { describe, expect, it } from "bun:test";
import {
	createRootListrOptions,
	DEFAULT_LISTR_RENDERER_OPTIONS,
	resolveListrRenderer,
} from "./listr-config";

describe("resolveListrRenderer", () => {
	it("uses verbose renderer when log level is debug", () => {
		expect(resolveListrRenderer("debug")).toBe("verbose");
	});

	it("uses default renderer for non-debug levels", () => {
		expect(resolveListrRenderer("info")).toBe("default");
		expect(resolveListrRenderer(undefined)).toBe("default");
	});
});

describe("createRootListrOptions", () => {
	it("merges concurrent flag and shared renderer options", () => {
		const options = createRootListrOptions({
			concurrent: true,
			logLevel: "debug",
		});

		expect(options).toEqual({
			concurrent: true,
			renderer: "verbose",
			rendererOptions: DEFAULT_LISTR_RENDERER_OPTIONS,
		});
	});
});
