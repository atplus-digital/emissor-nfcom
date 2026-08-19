import { describe, expect, it } from "bun:test";
import {
	isDiffDebug,
	setDiffDebug,
} from "@generators/lib/validation/diff-debug-options";

describe("diff-debug-options", () => {
	it("TC-UT-DDO-001: default state is disabled (false)", () => {
		setDiffDebug(false);
		expect(isDiffDebug()).toBe(false);
	});

	it("TC-UT-DDO-002: toggles on with true", () => {
		setDiffDebug(true);
		expect(isDiffDebug()).toBe(true);
	});

	it("TC-UT-DDO-003: toggles back off with false", () => {
		setDiffDebug(true);
		expect(isDiffDebug()).toBe(true);
		setDiffDebug(false);
		expect(isDiffDebug()).toBe(false);
	});
});
