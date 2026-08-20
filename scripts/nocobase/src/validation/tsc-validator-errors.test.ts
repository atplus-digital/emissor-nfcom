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
import * as os from "node:os";
import * as path from "node:path";

// Mock execFile para controlar códigos de saída do `tsc` de forma
// determinística (o binário nativo do TS7 sempre retorna exit 1, impossibilitando
// cobrir o branch de código != 1 com invocação real).
// Nota: promisify(execFile) só reconhece o mock se execFile for o próprio vi.fn().
const mockExecFile = vi.fn();
mock.module("node:child_process", () => {
	const actual = import.meta.require("node:child_process");
	return {
		...(actual as object),
		execFile: mockExecFile,
		default: {
			...(actual as object),
			execFile: mockExecFile,
		},
	};
});

const { resetTypeScriptValidationCache, validateTypeScriptFiles } =
	await import("./tsc-validator");

const TS_ERROR_LINES = [
	"/src/foo.ts(1,10): error TS2322: Type 'string' is not assignable to type 'number'.",
	"/src/bar.ts(2,5): error TS2304: Cannot find name 'x'.",
];

describe("tsc-validator errors (stubbed execFile)", () => {
	let tempRoot = "";

	beforeEach(() => {
		resetTypeScriptValidationCache();
		mockExecFile.mockReset();
		tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tsc-validator-stub-"));
		for (const name of [
			"invalid.ts",
			"internal-error.ts",
			"stderr-invalid.ts",
			"garbage.ts",
			"exit0.ts",
		]) {
			fs.writeFileSync(
				path.join(tempRoot, name),
				"export const ok: number = 1;\n",
				"utf-8",
			);
		}
	});

	afterEach(() => {
		resetTypeScriptValidationCache();
		vi.restoreAllMocks();
		if (tempRoot && fs.existsSync(tempRoot)) {
			fs.rmSync(tempRoot, { recursive: true, force: true });
		}
	});

	// TC-UT-VAL-ERR-001: exit code 1 → parse diagnostics e retorna false
	it("TC-UT-VAL-ERR-001: maps exit code 1 to false and writes diagnostics", async () => {
		const filePath = path.join(tempRoot, "invalid.ts");
		mockExecFile.mockImplementation((_cmd, _args, _opts, cb) => {
			const err = new Error("tsc failed") as Error & { code?: number };
			err.code = 1;
			(err as unknown as { stdout?: string }).stdout =
				TS_ERROR_LINES.join("\n");
			cb(err, "", "");
		});

		const result = await validateTypeScriptFiles([filePath]);

		expect(result).toBe(false);
	});

	// TC-UT-VAL-ERR-002: exit code != 1 → re-throw original error
	it("TC-UT-VAL-ERR-002: rethrows when exit code is not 1", async () => {
		const filePath = path.join(tempRoot, "internal-error.ts");
		mockExecFile.mockImplementation((_cmd, _args, _opts, cb) => {
			const err = new Error("tsc crashed") as Error & { code?: number };
			err.code = 2;
			cb(err, "", "");
		});

		await expect(validateTypeScriptFiles([filePath])).rejects.toThrow(
			"tsc crashed",
		);
	});

	// TC-UT-VAL-ERR-003: exit code 1 com saída em stderr ao invés de stdout
	it("TC-UT-VAL-ERR-003: parses stderr when stdout is absent on exit code 1", async () => {
		const filePath = path.join(tempRoot, "stderr-invalid.ts");
		mockExecFile.mockImplementation((_cmd, _args, _opts, cb) => {
			const err = new Error("tsc failed") as Error & {
				code?: number;
				stderr?: string;
			};
			err.code = 1;
			err.stderr = "/src/only-stderr.ts(3,1): error TS1005: ';' expected.";
			cb(err, "", "");
		});

		const result = await validateTypeScriptFiles([filePath]);

		expect(result).toBe(false);
	});

	// TC-UT-VAL-ERR-004: exit code 1 com stdout não-parseável (linhas soltas)
	it("TC-UT-VAL-ERR-004: tolerates unparseable stdout and returns false", async () => {
		const filePath = path.join(tempRoot, "garbage.ts");
		mockExecFile.mockImplementation((_cmd, _args, _opts, cb) => {
			const err = new Error("tsc failed") as Error & { code?: number };
			err.code = 1;
			(err as unknown as { stdout?: string }).stdout =
				"  \n  \n  random line with no match  \n  \n";
			cb(err, "", "");
		});

		const result = await validateTypeScriptFiles([filePath]);

		expect(result).toBe(false);
	});
});
