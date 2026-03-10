import { describe, expect, test } from "bun:test";

import {
  DIRECT_METRIC_KEY,
  UNKNOWN_METRIC_KEY,
  buildDailyAnalyticsRollupDeltas,
  getUtcRollupWindow,
} from "../db/durable/analyticsDailyRollups";

describe("buildDailyAnalyticsRollupDeltas", () => {
  test("aggregates daily site totals and metric facts", () => {
    const deltas = buildDailyAnalyticsRollupDeltas([
      {
        event: "page_view",
        client_page_url: "/pricing",
        country: "US",
        region: "CA",
        city: "San Francisco",
        device_type: "desktop",
        browser: "Chrome",
        operating_system: "macOS",
        referer: "",
        tag_id: "tag-1",
        createdAt: new Date("2026-03-08T10:15:00.000Z"),
      },
      {
        event: "signup_submitted",
        tag_id: "tag-1",
        createdAt: new Date("2026-03-08T10:20:00.000Z"),
      },
      {
        event: "conversion",
        tag_id: "tag-1",
        createdAt: new Date("2026-03-08T10:21:00.000Z"),
      },
    ]);

    expect(deltas.siteMetrics).toEqual([
      {
        utcDay: "2026-03-08",
        totalEvents: 3,
        pageViews: 1,
        conversionEvents: 1,
        updatedAt: Math.floor(new Date("2026-03-08T10:21:00.000Z").getTime() / 1000),
      },
    ]);

    const eventFact = deltas.metricFacts.find((item) => item.metricFamily === "event" && item.metricKey === "signup_submitted");
    expect(eventFact?.metricValue).toBe(1);
    expect(eventFact?.firstSeenAt).toBe(Math.floor(new Date("2026-03-08T10:20:00.000Z").getTime() / 1000));
    expect(eventFact?.lastSeenAt).toBe(Math.floor(new Date("2026-03-08T10:20:00.000Z").getTime() / 1000));

    const pageFact = deltas.metricFacts.find((item) => item.metricFamily === "page" && item.metricKey === "/pricing");
    expect(pageFact?.metricValue).toBe(1);

    const refererFact = deltas.metricFacts.find((item) => item.metricFamily === "referer");
    expect(refererFact?.metricKey).toBe(DIRECT_METRIC_KEY);

    const cityFact = deltas.metricFacts.find((item) => item.metricFamily === "city");
    expect(cityFact?.dimensionJson).toEqual({
      city: "San Francisco",
      country: "US",
    });
  });

  test("normalizes missing values into stable keys", () => {
    const deltas = buildDailyAnalyticsRollupDeltas([
      {
        event: "page_view",
        tag_id: "tag-1",
        createdAt: new Date("2026-03-08T10:15:00.000Z"),
      },
    ]);

    expect(deltas.metricFacts.some((item) => item.metricKey === UNKNOWN_METRIC_KEY)).toBe(true);
  });
});

describe("getUtcRollupWindow", () => {
  test("splits partial day edges around the full utc day window", () => {
    const window = getUtcRollupWindow(
      new Date("2026-03-08T05:00:00.000Z"),
      new Date("2026-03-10T04:59:59.999Z"),
    );

    expect(window.fullDayStartUtcDay).toBe("2026-03-09");
    expect(window.fullDayEndUtcDay).toBe("2026-03-09");
    expect(window.edgeRanges).toEqual([
      {
        start: new Date("2026-03-08T05:00:00.000Z"),
        end: new Date("2026-03-08T23:59:59.999Z"),
      },
      {
        start: new Date("2026-03-10T00:00:00.000Z"),
        end: new Date("2026-03-10T04:59:59.999Z"),
      },
    ]);
  });

  test("falls back to raw-only when no full utc days exist", () => {
    const window = getUtcRollupWindow(
      new Date("2026-03-08T05:00:00.000Z"),
      new Date("2026-03-08T12:00:00.000Z"),
    );

    expect(window.fullDayStartUtcDay).toBeNull();
    expect(window.fullDayEndUtcDay).toBeNull();
    expect(window.edgeRanges).toEqual([
      {
        start: new Date("2026-03-08T05:00:00.000Z"),
        end: new Date("2026-03-08T12:00:00.000Z"),
      },
    ]);
  });
});
