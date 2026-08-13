import { afterEach, describe, expect, it, vi } from "vitest";
import {
	writeCliError,
	writeCliErrorLines,
	writeCliWarning,
} from "./cli-output";

describe("cli-output", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("writeCliError prints to stderr", () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		writeCliError("falha");

		expect(errorSpy).toHaveBeenCalledWith("falha");
	});

	it("writeCliWarning prefixes message with warning emoji", () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		writeCliWarning("atenção");

		expect(warnSpy).toHaveBeenCalledWith("⚠️ atenção");
	});

	it("writeCliErrorLines prints up to maxLines entries", () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		writeCliErrorLines(["a", "b", "c"], 2);

		expect(errorSpy).toHaveBeenCalledTimes(2);
		expect(errorSpy).toHaveBeenNthCalledWith(1, "a");
		expect(errorSpy).toHaveBeenNthCalledWith(2, "b");
	});
});
