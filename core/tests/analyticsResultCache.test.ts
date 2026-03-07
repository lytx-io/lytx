import { describe, expect, test } from "bun:test";

import {
  HistoricalAnalyticsResultMemoryCache,
  buildAnalyticsResultCacheKey,
  getHistoricalAnalyticsCacheTtlMs,
  isHistoricalAnalyticsRange,
} from "../db/durable/analyticsResultCache";

describe("isHistoricalAnalyticsRange", () => {
  test("treats prior local days as historical", () => {
    expect(
      isHistoricalAnalyticsRange({
        endDate: new Date("2026-03-06T23:59:59.000Z"),
        timezone: "UTC",
        now: new Date("2026-03-07T12:00:00.000Z"),
      }),
    ).toBe(true);
  });

  test("does not treat today as historical", () => {
    expect(
      isHistoricalAnalyticsRange({
        endDate: new Date("2026-03-07T01:00:00.000Z"),
        timezone: "UTC",
        now: new Date("2026-03-07T12:00:00.000Z"),
      }),
    ).toBe(false);
  });
});

describe("getHistoricalAnalyticsCacheTtlMs", () => {
  test("keeps yesterday on a short ttl", () => {
    expect(
      getHistoricalAnalyticsCacheTtlMs({
        endDate: new Date("2026-03-06T23:59:59.000Z"),
        timezone: "UTC",
        now: new Date("2026-03-07T12:00:00.000Z"),
      }),
    ).toBe(5 * 60 * 1000);
  });

  test("gives older finalized windows a longer ttl", () => {
    expect(
      getHistoricalAnalyticsCacheTtlMs({
        endDate: new Date("2026-02-20T23:59:59.000Z"),
        timezone: "UTC",
        now: new Date("2026-03-07T12:00:00.000Z"),
      }),
    ).toBe(60 * 60 * 1000);
  });
});

describe("buildAnalyticsResultCacheKey", () => {
  test("normalizes object key order", () => {
    const left = buildAnalyticsResultCacheKey("dashboard-aggregates", {
      timezone: "UTC",
      filters: { city: "Toronto", country: "CA" },
    });
    const right = buildAnalyticsResultCacheKey("dashboard-aggregates", {
      filters: { country: "CA", city: "Toronto" },
      timezone: "UTC",
    });

    expect(left).toBe(right);
  });
});

describe("HistoricalAnalyticsResultMemoryCache", () => {
  test("returns cached values before expiry", () => {
    const cache = new HistoricalAnalyticsResultMemoryCache();
    cache.set("x", {
      expiresAt: Date.now() + 10_000,
      value: { total: 42 },
    });

    expect(cache.get<{ total: number }>("x")?.value).toEqual({ total: 42 });
  });

  test("evicts expired values on read", () => {
    const cache = new HistoricalAnalyticsResultMemoryCache();
    cache.set("x", {
      expiresAt: Date.now() + 1,
      value: { total: 42 },
    });

    expect(cache.get("x", Date.now() + 50)).toBeNull();
    expect(cache.get("x")).toBeNull();
  });

  test("trims oldest entries when capacity is exceeded", () => {
    const cache = new HistoricalAnalyticsResultMemoryCache(2);

    cache.set("first", {
      expiresAt: Date.now() + 10_000,
      value: 1,
    });
    cache.set("second", {
      expiresAt: Date.now() + 10_000,
      value: 2,
    });
    cache.set("third", {
      expiresAt: Date.now() + 10_000,
      value: 3,
    });

    expect(cache.get("first")).toBeNull();
    expect(cache.get<number>("second")?.value).toBe(2);
    expect(cache.get<number>("third")?.value).toBe(3);
  });
});
