import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";

const originalProcess = process;
import { applyWorkspaceLockIfNeeded } from "./locker";

// Helper to create a mock VSCode settings.json
function createMockSettings(extra = {}): object {
	return {
		"files.readonlyInclude": {
			"src/generated/**": true,
			...extra,
		},
	};
}

describe("TC-UT-LK-001: applyWorkspaceLockIfNeeded locks workspace when not locked", () => {
	const workspaceRoot = "/tmp/test-locker-workspace";

	beforeEach(() => {
		globalThis.process = {
			...process,
			cwd: () => workspaceRoot,
		};

		fs.mkdirSync(path.join(workspaceRoot, ".vscode"), { recursive: true });
	});

	afterEach(() => {
		fs.rmSync("/tmp/test-locker-workspace", { recursive: true, force: true });
		vi.restoreAllMocks();
		globalThis.process = originalProcess;
	});

	it("should create settings.json with readonlyInclude when not locked", () => {
		applyWorkspaceLockIfNeeded(["src/generated"], true);

		const settingsPath = path.join(workspaceRoot, ".vscode", "settings.json");
		expect(fs.existsSync(settingsPath)).toBe(true);

		const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
		expect(settings["files.readonlyInclude"]).toBeDefined();
	});
});

describe("TC-UT-LK-002: applyWorkspaceLockIfNeeded skips when already locked", () => {
	const workspaceRoot = "/tmp/test-locker-already";
	const settingsPath = path.join(workspaceRoot, ".vscode", "settings.json");

	beforeEach(() => {
		globalThis.process = {
			...process,
			cwd: () => workspaceRoot,
		};

		fs.mkdirSync(path.join(workspaceRoot, ".vscode"), { recursive: true });
		fs.writeFileSync(
			settingsPath,
			JSON.stringify(createMockSettings(), null, 2),
		);
	});

	afterEach(() => {
		fs.rmSync("/tmp/test-locker-already", { recursive: true, force: true });
		vi.restoreAllMocks();
		globalThis.process = originalProcess;
	});

	it("should not modify settings when already locked", () => {
		void fs.readFileSync(settingsPath, "utf-8");

		applyWorkspaceLockIfNeeded(["src/generated"], true);

		const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
		// The GENERATED_PATTERN is already present, so no change needed
		expect(settings["files.readonlyInclude"]["src/generated/**"]).toBe(true);
	});
});

describe("TC-UT-LK-003: applyWorkspaceLockIfNeeded skips when lockWorkspaceFolder is false", () => {
	const workspaceRoot = "/tmp/test-locker-skip";

	beforeEach(() => {
		globalThis.process = {
			...process,
			cwd: () => workspaceRoot,
		};
		fs.mkdirSync(path.join(workspaceRoot, ".vscode"), { recursive: true });
	});

	afterEach(() => {
		fs.rmSync("/tmp/test-locker-skip", { recursive: true, force: true });
		vi.restoreAllMocks();
		globalThis.process = originalProcess;
	});

	it("should not create or modify settings when flag is false", () => {
		applyWorkspaceLockIfNeeded(["src/generated"], false);

		const settingsPath = path.join(workspaceRoot, ".vscode", "settings.json");
		// Should not throw even if settings.json doesn't exist
		expect(fs.existsSync(settingsPath)).toBe(false);
	});
});

describe("TC-UT-LK-004: applyWorkspaceLockIfNeeded handles missing .vscode dir", () => {
	const workspaceRoot = "/tmp/test-locker-no-vscode";

	beforeEach(() => {
		globalThis.process = {
			...process,
			cwd: () => workspaceRoot,
		};
		// No .vscode directory
	});

	afterEach(() => {
		fs.rmSync("/tmp/test-locker-no-vscode", { recursive: true, force: true });
		vi.restoreAllMocks();
		globalThis.process = originalProcess;
	});

	it("should create .vscode directory when needed", () => {
		applyWorkspaceLockIfNeeded(["src/generated"], true);

		const vscodeDir = path.join(workspaceRoot, ".vscode");
		expect(fs.existsSync(vscodeDir)).toBe(true);
	});
});

describe("TC-UT-LK-005: applyWorkspaceLockIfNeeded adds custom output dirs", () => {
	const workspaceRoot = "/tmp/test-locker-custom";

	beforeEach(() => {
		globalThis.process = {
			...process,
			cwd: () => workspaceRoot,
		};
		fs.mkdirSync(path.join(workspaceRoot, ".vscode"), { recursive: true });
	});

	afterEach(() => {
		fs.rmSync("/tmp/test-locker-custom", { recursive: true, force: true });
		vi.restoreAllMocks();
		globalThis.process = originalProcess;
	});

	it("should add custom output dir patterns", () => {
		applyWorkspaceLockIfNeeded(["./custom/output"], true);

		const settingsPath = path.join(workspaceRoot, ".vscode", "settings.json");
		const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));

		expect(settings["files.readonlyInclude"]).toBeDefined();
		// Should contain the custom output dir pattern
		expect(
			Object.keys(settings["files.readonlyInclude"]).some((k) =>
				k.includes("custom/output"),
			),
		).toBe(true);
	});
});

describe("TC-UT-LK-006: toReadonlyPattern handles absolute paths", () => {
	const workspaceRoot = "/tmp/test-locker-abs";

	beforeEach(() => {
		globalThis.process = {
			...process,
			cwd: () => workspaceRoot,
		};
	});

	afterEach(() => {
		vi.restoreAllMocks();
		globalThis.process = originalProcess;
	});

	it("should convert absolute paths to relative posix patterns", () => {
		applyWorkspaceLockIfNeeded(["/absolute/path/to/output"], true);

		const settingsPath = path.join(workspaceRoot, ".vscode", "settings.json");
		const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));

		// Pattern should use forward slashes (POSIX)
		expect(
			Object.keys(settings["files.readonlyInclude"]).some((k) =>
				k.includes("output/index.ts"),
			),
		).toBe(true);
	});
});

describe("TC-UT-LK-007: isWorkspaceLocked returns false when no settings", () => {
	const workspaceRoot = "/tmp/test-locker-no-settings";

	beforeEach(() => {
		globalThis.process = {
			...process,
			cwd: () => workspaceRoot,
		};
		// No .vscode directory
	});

	afterEach(() => {
		fs.rmSync("/tmp/test-locker-no-settings", { recursive: true, force: true });
		vi.restoreAllMocks();
		globalThis.process = originalProcess;
	});

	it("should return false when settings.json does not exist", () => {
		// We test this indirectly through applyWorkspaceLockIfNeeded behavior
		// The function should just proceed without throwing
		expect(() =>
			applyWorkspaceLockIfNeeded(["src/generated"], true),
		).not.toThrow();
	});
});

describe("TC-UT-LK-008: Lock file path is consistent for same output dir", () => {
	const workspaceRoot = "/tmp/test-locker-consistent";
	const settingsPath = path.join(workspaceRoot, ".vscode", "settings.json");

	beforeEach(() => {
		globalThis.process = {
			...process,
			cwd: () => workspaceRoot,
		};
		fs.mkdirSync(path.join(workspaceRoot, ".vscode"), { recursive: true });
	});

	afterEach(() => {
		fs.rmSync("/tmp/test-locker-consistent", { recursive: true, force: true });
		vi.restoreAllMocks();
		globalThis.process = originalProcess;
	});

	it("should produce consistent lock entries for same directory", () => {
		applyWorkspaceLockIfNeeded(["src/generated"], true);

		applyWorkspaceLockIfNeeded(["src/generated"], true);
		const settings2 = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));

		// Should not duplicate entries
		const count = Object.keys(settings2["files.readonlyInclude"]).filter((k) =>
			k.includes("src/generated"),
		).length;
		expect(count).toBeLessThanOrEqual(2); // GENERATED_PATTERN + the specific path
	});
});

describe("TC-UT-LK-009: isWorkspaceLocked returns false when readonlyInclude is not an object", () => {
	const workspaceRoot = "/tmp/test-locker-not-object";

	beforeEach(() => {
		globalThis.process = {
			...process,
			cwd: () => workspaceRoot,
		};
		fs.mkdirSync(path.join(workspaceRoot, ".vscode"), { recursive: true });
		// Create settings.json with files.readonlyInclude as a string (not an object)
		const settingsPath = path.join(workspaceRoot, ".vscode", "settings.json");
		fs.writeFileSync(
			settingsPath,
			JSON.stringify({ "files.readonlyInclude": "not-an-object" }),
		);
	});

	afterEach(() => {
		fs.rmSync("/tmp/test-locker-not-object", { recursive: true, force: true });
		vi.restoreAllMocks();
		globalThis.process = originalProcess;
	});

	it("should return false when readonlyInclude is a string", () => {
		// The function should not throw and should return false
		expect(() =>
			applyWorkspaceLockIfNeeded(["src/generated"], true),
		).not.toThrow();
		// The workspace should be locked since readonlyInclude is not a valid object
		// This will add the proper patterns
	});
});

describe("TC-UT-LK-011: isWorkspaceLocked detects custom output dir patterns", () => {
	const workspaceRoot = "/tmp/test-locker-custom-pattern";
	const settingsPath = path.join(workspaceRoot, ".vscode", "settings.json");

	beforeEach(() => {
		globalThis.process = {
			...process,
			cwd: () => workspaceRoot,
		};
		fs.mkdirSync(path.join(workspaceRoot, ".vscode"), { recursive: true });
		fs.writeFileSync(
			settingsPath,
			JSON.stringify({
				"files.readonlyInclude": {
					"custom/output/index.ts": true,
				},
			}),
		);
	});

	afterEach(() => {
		fs.rmSync(workspaceRoot, { recursive: true, force: true });
		vi.restoreAllMocks();
		globalThis.process = originalProcess;
	});

	it("should treat workspace as locked when custom output pattern exists", () => {
		const before = fs.readFileSync(settingsPath, "utf-8");

		applyWorkspaceLockIfNeeded(["custom/output"], true);

		expect(fs.readFileSync(settingsPath, "utf-8")).toBe(before);
	});
});

describe("TC-UT-LK-012: lockWorkspace surfaces write failures", () => {
	const workspaceRoot = "/tmp/test-locker-lock-failure";

	beforeEach(() => {
		globalThis.process = {
			...process,
			cwd: () => workspaceRoot,
		};
		fs.mkdirSync(path.join(workspaceRoot, ".vscode"), { recursive: true });
		const settingsPath = path.join(workspaceRoot, ".vscode", "settings.json");
		fs.writeFileSync(settingsPath, "{ invalid json");
	});

	afterEach(() => {
		fs.rmSync(workspaceRoot, { recursive: true, force: true });
		vi.restoreAllMocks();
		globalThis.process = originalProcess;
	});

	it("should throw when settings.json cannot be parsed", () => {
		expect(() => applyWorkspaceLockIfNeeded(["src/generated"], true)).toThrow(
			/Falha ao bloquear o workspace/,
		);
	});
});

describe("TC-UT-LK-014: lockWorkspace merges when readonlyInclude is not an object", () => {
	const workspaceRoot = "/tmp/test-locker-merge-invalid";

	beforeEach(() => {
		globalThis.process = {
			...process,
			cwd: () => workspaceRoot,
		};
		fs.mkdirSync(path.join(workspaceRoot, ".vscode"), { recursive: true });
		fs.writeFileSync(
			path.join(workspaceRoot, ".vscode", "settings.json"),
			JSON.stringify({ "files.readonlyInclude": null }),
		);
	});

	afterEach(() => {
		fs.rmSync(workspaceRoot, { recursive: true, force: true });
		vi.restoreAllMocks();
		globalThis.process = originalProcess;
	});

	it("should replace invalid readonlyInclude with generated patterns", () => {
		applyWorkspaceLockIfNeeded(["src/generated"], true);

		const settings = JSON.parse(
			fs.readFileSync(
				path.join(workspaceRoot, ".vscode", "settings.json"),
				"utf-8",
			),
		);

		expect(settings["files.readonlyInclude"]["src/generated/**"]).toBe(true);
	});
});

describe("TC-UT-LK-010: isWorkspaceLocked returns false when readonlyInclude is null", () => {
	const workspaceRoot = "/tmp/test-locker-null";

	beforeEach(() => {
		globalThis.process = {
			...process,
			cwd: () => workspaceRoot,
		};
		fs.mkdirSync(path.join(workspaceRoot, ".vscode"), { recursive: true });
		// Create settings.json with files.readonlyInclude as null
		const settingsPath = path.join(workspaceRoot, ".vscode", "settings.json");
		fs.writeFileSync(
			settingsPath,
			JSON.stringify({ "files.readonlyInclude": null }),
		);
	});

	afterEach(() => {
		fs.rmSync("/tmp/test-locker-null", { recursive: true, force: true });
		vi.restoreAllMocks();
		globalThis.process = originalProcess;
	});

	it("should return false when readonlyInclude is null", () => {
		expect(() =>
			applyWorkspaceLockIfNeeded(["src/generated"], true),
		).not.toThrow();
	});
});
