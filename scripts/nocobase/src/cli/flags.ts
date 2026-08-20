// Flags de runtime definidos pelo CLI (index.ts) e lidos pelo kernel
// (lifecycle) durante a execução de uma geração.

let validationSkipped = false;
let diffDebugEnabled = false;

export function setValidationSkipped(skipped: boolean): void {
	validationSkipped = skipped;
}

export function isValidationSkipped(): boolean {
	return validationSkipped;
}

export function setDiffDebug(enabled: boolean): void {
	diffDebugEnabled = enabled;
}

export function isDiffDebug(): boolean {
	return diffDebugEnabled;
}
