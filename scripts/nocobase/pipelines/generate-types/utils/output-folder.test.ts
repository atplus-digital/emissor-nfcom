import { describe, expect, it } from "bun:test";
import { toDataSourceOutputFolder } from "./output-folder";

describe("toDataSourceOutputFolder", () => {
	it("maps the legacy `main` datasource to `nocobase`", () => {
		expect(toDataSourceOutputFolder("main")).toBe("nocobase");
	});

	it("keeps `nocobase` as-is", () => {
		expect(toDataSourceOutputFolder("nocobase")).toBe("nocobase");
	});

	it("keeps simple keys as-is", () => {
		expect(toDataSourceOutputFolder("ixc")).toBe("ixc");
	});

	it("keeps hyphenated keys as-is", () => {
		expect(toDataSourceOutputFolder("my-data-source")).toBe("my-data-source");
	});

	it("normalizes spaces to hyphens", () => {
		expect(toDataSourceOutputFolder("my data source")).toBe("my-data-source");
	});

	it("normalizes special characters", () => {
		expect(toDataSourceOutputFolder("data@source!")).toBe("data-source-");
	});
});
