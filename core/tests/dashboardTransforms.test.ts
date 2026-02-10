import { describe, expect, test } from "bun:test";

import {
  calculateAverageSessionDurationSeconds,
  cleanPageUrl,
  cleanReferer,
  countBy,
  countDistinctBy,
  formatDurationSeconds,
  formatPercent,
  toDateKey,
} from "@utilities/dashboardTransforms";

describe("dashboardTransforms", () => {
  test("cleanReferer normalizes to hostname and Direct", () => {
    expect(cleanReferer("")).toBe("Direct");
    expect(cleanReferer(null)).toBe("Direct");
    expect(cleanReferer("null")).toBe("Direct");
    expect(cleanReferer("https://google.com/search?q=1")).toBe("google.com");
    expect(cleanReferer("http://example.com/path")).toBe("example.com");
    expect(cleanReferer("example.com/path")).toBe("example.com");
  });

  test("cleanPageUrl extracts path and query", () => {
    expect(cleanPageUrl("")).toBe("Unknown");
    expect(cleanPageUrl("null")).toBe("Unknown");
    expect(cleanPageUrl("https://pw.local/pricing?ref=1")).toBe(
      "/pricing?ref=1",
    );
    expect(cleanPageUrl("/just/a/path")).toBe("/just/a/path");
  });

  test("count helpers and formatting helpers", () => {
    const items: Array<{ rid: string | null; event: string }> = [
      { rid: "a", event: "page_view" },
      { rid: "a", event: "page_view" },
      { rid: "b", event: "conversion" },
      { rid: null, event: "page_view" },
    ];

    expect(countDistinctBy(items, (item: { rid: string | null }) => item.rid)).toBe(2);

    const counts = countBy(
      items,
      (item: { rid: string | null; event: string }) =>
        item.event === "page_view" ? item.rid : null,
    );
    expect(counts.get("a")).toBe(2);

    expect(formatPercent(66.666, 1)).toBe("66.7%");
    expect(formatPercent(33.3333, 2)).toBe("33.33%");
    expect(formatDurationSeconds(0)).toBe("0s");
    expect(formatDurationSeconds(61)).toBe("1m 1s");

    const key = toDateKey(new Date("2026-01-14T12:00:00.000Z"));
    expect(key).toBe("2026-01-14");
  });

  test("calculateAverageSessionDurationSeconds averages session spans", () => {
    const events = [
      { rid: "a", createdAt: new Date("2026-01-14T00:00:00.000Z") },
      { rid: "a", createdAt: new Date("2026-01-14T00:01:00.000Z") },
      { rid: "b", createdAt: new Date("2026-01-14T00:00:10.000Z") },
      { rid: "b", createdAt: new Date("2026-01-14T00:00:40.000Z") },
    ];

    const avg = calculateAverageSessionDurationSeconds(events, {
      getSessionId: (event: { rid: string }) => event.rid,
      getTimestamp: (event: { createdAt: Date }) => event.createdAt,
    });

    // session a: 60s, session b: 30s => avg 45s
    expect(avg).toBe(45);
  });
});
