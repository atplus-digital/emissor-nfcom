let diffDebugEnabled = false;

export function setDiffDebug(enabled: boolean): void {
	diffDebugEnabled = enabled;
}

export function isDiffDebug(): boolean {
	return diffDebugEnabled;
}
