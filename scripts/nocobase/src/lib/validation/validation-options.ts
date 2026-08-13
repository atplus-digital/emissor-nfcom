let validationSkipped = false;

export function setValidationSkipped(skipped: boolean): void {
	validationSkipped = skipped;
}

export function isValidationSkipped(): boolean {
	return validationSkipped;
}
