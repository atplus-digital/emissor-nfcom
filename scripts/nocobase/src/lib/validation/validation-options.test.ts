import { describe, expect, it } from "bun:test";
import {
	isValidationSkipped,
	setValidationSkipped,
} from "@generators/lib/validation/validation-options";

describe("validation-options", () => {
	it("TC-UT-VO-001: default state is not skipped (false)", () => {
		setValidationSkipped(false);
		expect(isValidationSkipped()).toBe(false);
	});

	it("TC-UT-VO-002: marks skipped with true", () => {
		setValidationSkipped(true);
		expect(isValidationSkipped()).toBe(true);
	});

	it("TC-UT-VO-003: clears the skipped flag with false", () => {
		setValidationSkipped(true);
		expect(isValidationSkipped()).toBe(true);
		setValidationSkipped(false);
		expect(isValidationSkipped()).toBe(false);
	});
});
