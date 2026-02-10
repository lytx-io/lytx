import { describe, expect, test } from "bun:test";

import {
	matchesSourceFilter,
	parseDateParam,
	parseSiteIdParam,
} from "../src/utilities/dashboardParams";

describe("parseSiteIdParam", () => {
	test("parses number", () => {
		expect(parseSiteIdParam(123)).toBe(123);
	});

	test("parses numeric string", () => {
		expect(parseSiteIdParam("456")).toBe(456);
	});

	test("rejects empty string", () => {
		expect(parseSiteIdParam("   ")).toBeNull();
	});

	test("rejects non-numeric", () => {
		expect(parseSiteIdParam("abc")).toBeNull();
	});
});

describe("parseDateParam", () => {
	test("parses ISO date string", () => {
		const parsed = parseDateParam("2026-01-14");
		expect(parsed).not.toBeNull();
		expect(parsed instanceof Date).toBe(true);
	});

	test("rejects invalid date string", () => {
		expect(parseDateParam("not-a-date")).toBeNull();
	});
});

describe("matchesSourceFilter", () => {
	test("matches direct when referer missing", () => {
		expect(matchesSourceFilter(null, "direct")).toBe(true);
	});

	test("matches google hostname", () => {
		expect(matchesSourceFilter("https://google.com/search?q=x", "google")).toBe(true);
	});

	test("does not match direct for non-empty referer", () => {
		expect(matchesSourceFilter("https://google.com", "direct")).toBe(false);
	});
});
