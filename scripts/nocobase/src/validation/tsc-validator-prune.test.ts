import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	mock,
	vi,
} from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";

// Mocka node:fs para forçar readdirSync do diretório de cache a lançar,
// exercitando o catch best-effort do pruneStaleTempBuildInfos (linha 66).
// Apenas readdirSync do CACHE_DIR falha; o resto do fs é real.
const CACHE_DIR = path.resolve(
	process.cwd(),
	".cache",
	"crm-atplus-tsc-validator",
);

const realFs = import.meta.require("node:fs") as typeof fs;
const readdirSync = vi.fn((p: string, ...rest: unknown[]) =>
	realFs.readdirSync(
		p as Parameters<typeof fs.readdirSync>[0],
		...(rest as []),
	),
);

mock.module("node:fs", () => ({
	...realFs,
	readdirSync,
}));

const { resetTypeScriptValidationCache, validateTypeScriptFiles } =
	await import("./tsc-validator");

describe("tsc-validator prune catch (stubbed readdirSync)", () => {
	// Usa um arquivo fora de /tmp para que o slug NÃO comece com `_tmp_`,
	// fazendo a validação passar pelo pruneStaleTempBuildInfos.
	let nonTmpDir = "";

	beforeEach(() => {
		resetTypeScriptValidationCache();
		readdirSync.mockClear();
		readdirSync.mockImplementation((p: string, ...rest: unknown[]) =>
			realFs.readdirSync(
				p as Parameters<typeof fs.readdirSync>[0],
				...(rest as []),
			),
		);
		fs.mkdirSync(CACHE_DIR, { recursive: true });
		nonTmpDir = path.join(process.cwd(), ".cache", "tsc-prune-catch-test");
		fs.mkdirSync(nonTmpDir, { recursive: true });
	});

	afterEach(() => {
		resetTypeScriptValidationCache();
		vi.restoreAllMocks();
		fs.rmSync(nonTmpDir, { recursive: true, force: true });
	});

	// TC-UT-VAL-PRUNE-001: readdirSync do cache falha → limpeza é ignorada
	it("TC-UT-VAL-PRUNE-001: ignores readdir failures when pruning stale cache", async () => {
		const filePath = path.join(nonTmpDir, "valid.ts");
		fs.writeFileSync(filePath, "export const ok: number = 1;\n", "utf-8");

		readdirSync.mockImplementation((p: string) => {
			if (path.resolve(p) === path.resolve(CACHE_DIR)) {
				throw new Error("EACCES: permission denied");
			}
			return realFs.readdirSync(p as Parameters<typeof fs.readdirSync>[0]);
		});

		const result = await validateTypeScriptFiles([filePath]);

		expect(result).toBe(true);
		expect(readdirSync).toHaveBeenCalled();
	});

	// TC-UT-VAL-PRUNE-002: entrada __tmp_ no cache é removida durante prune
	it("TC-UT-VAL-PRUNE-002: removes _tmp_ entries and keeps non-tmp entries", async () => {
		const stale = path.join(CACHE_DIR, "_tmp_fake-p.tsbuildinfo");
		const keep = path.join(CACHE_DIR, "normal-cache.tsbuildinfo");
		fs.writeFileSync(stale, "{}");
		fs.writeFileSync(keep, "{}");

		const filePath = path.join(nonTmpDir, "valid.ts");
		fs.writeFileSync(filePath, "export const ok: number = 1;\n", "utf-8");

		// Restaura readdirSync real para esta validação de limpeza.
		readdirSync.mockImplementation((p: string, ...rest: unknown[]) =>
			realFs.readdirSync(
				p as Parameters<typeof fs.readdirSync>[0],
				...(rest as []),
			),
		);

		await validateTypeScriptFiles([filePath]);

		expect(fs.existsSync(stale)).toBe(false);
		expect(fs.existsSync(keep)).toBe(true);

		fs.rmSync(stale, { force: true });
		fs.rmSync(keep, { force: true });
	});
});
