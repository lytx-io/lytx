import { describe, expect, test } from "bun:test";

import {
  createPresetDateRange,
  isRealtimeDateRangePreset,
} from "../src/app/components/charts/ChartComponents";

describe("isRealtimeDateRangePreset", () => {
  test("treats Today as a realtime preset", () => {
    expect(isRealtimeDateRangePreset("Today")).toBe(true);
  });

  test("does not treat historical presets as realtime", () => {
    expect(isRealtimeDateRangePreset("Yesterday")).toBe(false);
    expect(isRealtimeDateRangePreset("Last 7 days")).toBe(false);
  });
});

describe("createPresetDateRange", () => {
  test("adds a refresh key for Today so repeated selections refetch", () => {
    const now = new Date("2026-03-07T15:04:05.000Z");
    const range = createPresetDateRange("Today", "UTC", now);

    expect(range).toEqual({
      start: "2026-03-07",
      end: "2026-03-07",
      preset: "Today",
      refreshKey: now.getTime(),
    });
  });

  test("keeps historical presets cacheable", () => {
    const now = new Date("2026-03-07T15:04:05.000Z");
    const range = createPresetDateRange("Yesterday", "UTC", now);

    expect(range).toEqual({
      start: "2026-03-06",
      end: "2026-03-06",
      preset: "Yesterday",
    });
  });
});
