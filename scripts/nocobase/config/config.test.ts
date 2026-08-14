import { describe, expect, it } from "bun:test";
import { dataSourceConfigs } from "./datasources";

describe("generators config modules", () => {
	it("exports datasource generation configs", () => {
		expect(dataSourceConfigs.length).toBeGreaterThan(0);
		expect(dataSourceConfigs.some((config) => config.name === "nocobase")).toBe(
			true,
		);
		expect(dataSourceConfigs.some((config) => config.name === "ixc")).toBe(
			true,
		);
	});
});
