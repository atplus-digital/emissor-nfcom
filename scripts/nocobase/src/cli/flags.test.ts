import { afterEach, describe, expect, it } from "bun:test";
import {
	isDiffDebug,
	isValidationSkipped,
	setDiffDebug,
	setValidationSkipped,
} from "./flags";

describe("flags", () => {
	afterEach(() => {
		setValidationSkipped(false);
		setDiffDebug(false);
	});

	describe("validationSkipped", () => {
		it("defaults to false", () => {
			expect(isValidationSkipped()).toBe(false);
		});

		it("reflects setValidationSkipped(true)", () => {
			setValidationSkipped(true);
			expect(isValidationSkipped()).toBe(true);
		});

		it("can be reset to false", () => {
			setValidationSkipped(true);
			setValidationSkipped(false);
			expect(isValidationSkipped()).toBe(false);
		});
	});

	describe("diffDebug", () => {
		it("defaults to false", () => {
			expect(isDiffDebug()).toBe(false);
		});

		it("reflects setDiffDebug(true)", () => {
			setDiffDebug(true);
			expect(isDiffDebug()).toBe(true);
		});

		it("can be reset to false", () => {
			setDiffDebug(true);
			setDiffDebug(false);
			expect(isDiffDebug()).toBe(false);
		});
	});
});
