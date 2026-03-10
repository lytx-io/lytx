//! Helpers for building and querying additive daily analytics rollups.

import type { SiteEventInput } from "./types";

export const UNKNOWN_METRIC_KEY = "__unknown__";
export const DIRECT_METRIC_KEY = "__direct__";
const COMPOSITE_KEY_SEPARATOR = "\u001f";

export const analyticsMetricFamilies = [
  "page",
  "event",
  "country",
  "region",
  "city",
  "device",
  "browser",
  "os",
  "referer",
] as const;

export type AnalyticsMetricFamily = typeof analyticsMetricFamilies[number];

export type DailySiteMetricDelta = {
  utcDay: string;
  totalEvents: number;
  pageViews: number;
  conversionEvents: number;
  updatedAt: number;
};

export type DailyMetricFactDimension = Record<string, string | null>;

export type DailyMetricFactDelta = {
  utcDay: string;
  metricFamily: AnalyticsMetricFamily;
  metricKey: string;
  metricValue: number;
  dimensionJson: DailyMetricFactDimension | null;
  firstSeenAt: number | null;
  lastSeenAt: number | null;
  updatedAt: number;
};

export type DailyAnalyticsRollupDeltaSet = {
  siteMetrics: DailySiteMetricDelta[];
  metricFacts: DailyMetricFactDelta[];
};

export type DateRange = {
  start: Date;
  end: Date;
};

export type UtcRollupWindow = {
  fullDayStartUtcDay: string | null;
  fullDayEndUtcDay: string | null;
  edgeRanges: DateRange[];
};

function isPageViewEvent(event: string): boolean {
  return event === "page_view";
}

function isConversionEvent(event: string): boolean {
  return event === "conversion" || event === "purchase";
}

function toUnixSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

export function toUtcDayBucket(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfUtcDay(date: Date): Date {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

function endOfUtcDay(date: Date): Date {
  const end = new Date(date);
  end.setUTCHours(23, 59, 59, 999);
  return end;
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function isStartOfUtcDay(date: Date): boolean {
  return date.getUTCHours() === 0
    && date.getUTCMinutes() === 0
    && date.getUTCSeconds() === 0
    && date.getUTCMilliseconds() === 0;
}

function isEndOfUtcDay(date: Date): boolean {
  return date.getUTCHours() === 23
    && date.getUTCMinutes() === 59
    && date.getUTCSeconds() === 59
    && date.getUTCMilliseconds() === 999;
}

function normalizeMetricKey(value?: string | null): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : UNKNOWN_METRIC_KEY;
}

function normalizeRefererMetricKey(value?: string | null): string {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "null") return DIRECT_METRIC_KEY;
  return trimmed;
}

function buildCityMetricKey(city?: string | null, country?: string | null): string {
  return `${normalizeMetricKey(country)}${COMPOSITE_KEY_SEPARATOR}${normalizeMetricKey(city)}`;
}

function upsertSiteMetricDelta(
  target: Map<string, DailySiteMetricDelta>,
  utcDay: string,
  timestampSeconds: number,
  eventName: string,
) {
  const current = target.get(utcDay) ?? {
    utcDay,
    totalEvents: 0,
    pageViews: 0,
    conversionEvents: 0,
    updatedAt: timestampSeconds,
  };

  current.totalEvents += 1;
  if (isPageViewEvent(eventName)) current.pageViews += 1;
  if (isConversionEvent(eventName)) current.conversionEvents += 1;
  current.updatedAt = Math.max(current.updatedAt, timestampSeconds);
  target.set(utcDay, current);
}

function upsertMetricFactDelta(
  target: Map<string, DailyMetricFactDelta>,
  input: DailyMetricFactDelta,
) {
  const mapKey = `${input.utcDay}${COMPOSITE_KEY_SEPARATOR}${input.metricFamily}${COMPOSITE_KEY_SEPARATOR}${input.metricKey}`;
  const current = target.get(mapKey);
  if (!current) {
    target.set(mapKey, { ...input });
    return;
  }

  current.metricValue += input.metricValue;
  current.updatedAt = Math.max(current.updatedAt, input.updatedAt);
  if (input.firstSeenAt !== null) {
    current.firstSeenAt = current.firstSeenAt === null
      ? input.firstSeenAt
      : Math.min(current.firstSeenAt, input.firstSeenAt);
  }
  if (input.lastSeenAt !== null) {
    current.lastSeenAt = current.lastSeenAt === null
      ? input.lastSeenAt
      : Math.max(current.lastSeenAt, input.lastSeenAt);
  }
  if (input.dimensionJson) {
    current.dimensionJson = input.dimensionJson;
  }
}

function createMetricFactDelta(
  utcDay: string,
  metricFamily: AnalyticsMetricFamily,
  metricKey: string,
  timestampSeconds: number,
  dimensionJson: DailyMetricFactDimension | null = null,
  includeSeenWindow = false,
): DailyMetricFactDelta {
  return {
    utcDay,
    metricFamily,
    metricKey,
    metricValue: 1,
    dimensionJson,
    firstSeenAt: includeSeenWindow ? timestampSeconds : null,
    lastSeenAt: includeSeenWindow ? timestampSeconds : null,
    updatedAt: timestampSeconds,
  };
}

export function buildDailyAnalyticsRollupDeltas(
  events: SiteEventInput[],
): DailyAnalyticsRollupDeltaSet {
  const siteMetrics = new Map<string, DailySiteMetricDelta>();
  const metricFacts = new Map<string, DailyMetricFactDelta>();

  for (const event of events) {
    const createdAt = event.createdAt ?? new Date();
    const utcDay = toUtcDayBucket(createdAt);
    const timestampSeconds = toUnixSeconds(createdAt);

    upsertSiteMetricDelta(siteMetrics, utcDay, timestampSeconds, event.event);
    upsertMetricFactDelta(
      metricFacts,
      createMetricFactDelta(
        utcDay,
        "event",
        normalizeMetricKey(event.event),
        timestampSeconds,
        null,
        true,
      ),
    );

    if (!isPageViewEvent(event.event)) {
      continue;
    }

    upsertMetricFactDelta(
      metricFacts,
      createMetricFactDelta(
        utcDay,
        "page",
        normalizeMetricKey(event.client_page_url),
        timestampSeconds,
      ),
    );
    upsertMetricFactDelta(
      metricFacts,
      createMetricFactDelta(
        utcDay,
        "country",
        normalizeMetricKey(event.country),
        timestampSeconds,
      ),
    );
    upsertMetricFactDelta(
      metricFacts,
      createMetricFactDelta(
        utcDay,
        "region",
        normalizeMetricKey(event.region),
        timestampSeconds,
      ),
    );
    upsertMetricFactDelta(
      metricFacts,
      createMetricFactDelta(
        utcDay,
        "city",
        buildCityMetricKey(event.city, event.country),
        timestampSeconds,
        {
          city: event.city?.trim() || null,
          country: event.country?.trim() || null,
        },
      ),
    );
    upsertMetricFactDelta(
      metricFacts,
      createMetricFactDelta(
        utcDay,
        "device",
        normalizeMetricKey(event.device_type),
        timestampSeconds,
      ),
    );
    upsertMetricFactDelta(
      metricFacts,
      createMetricFactDelta(
        utcDay,
        "browser",
        normalizeMetricKey(event.browser),
        timestampSeconds,
      ),
    );
    upsertMetricFactDelta(
      metricFacts,
      createMetricFactDelta(
        utcDay,
        "os",
        normalizeMetricKey(event.operating_system),
        timestampSeconds,
      ),
    );
    upsertMetricFactDelta(
      metricFacts,
      createMetricFactDelta(
        utcDay,
        "referer",
        normalizeRefererMetricKey(event.referer),
        timestampSeconds,
      ),
    );
  }

  return {
    siteMetrics: Array.from(siteMetrics.values()).toSorted((left, right) => left.utcDay.localeCompare(right.utcDay)),
    metricFacts: Array.from(metricFacts.values()).toSorted((left, right) => {
      const dayCompare = left.utcDay.localeCompare(right.utcDay);
      if (dayCompare !== 0) return dayCompare;
      const familyCompare = left.metricFamily.localeCompare(right.metricFamily);
      if (familyCompare !== 0) return familyCompare;
      return left.metricKey.localeCompare(right.metricKey);
    }),
  };
}

export function getUtcRollupWindow(start: Date, end: Date): UtcRollupWindow {
  if (start.getTime() > end.getTime()) {
    return {
      fullDayStartUtcDay: null,
      fullDayEndUtcDay: null,
      edgeRanges: [],
    };
  }

  const rawFullDayStart = isStartOfUtcDay(start)
    ? startOfUtcDay(start)
    : addUtcDays(startOfUtcDay(start), 1);
  const rawFullDayEnd = isEndOfUtcDay(end)
    ? endOfUtcDay(end)
    : endOfUtcDay(addUtcDays(startOfUtcDay(end), -1));

  if (rawFullDayStart.getTime() > rawFullDayEnd.getTime()) {
    return {
      fullDayStartUtcDay: null,
      fullDayEndUtcDay: null,
      edgeRanges: [{ start, end }],
    };
  }

  const edgeRanges: DateRange[] = [];
  const leadingEdgeEnd = new Date(rawFullDayStart.getTime() - 1);
  if (start.getTime() <= leadingEdgeEnd.getTime()) {
    edgeRanges.push({
      start,
      end: leadingEdgeEnd.getTime() < end.getTime() ? leadingEdgeEnd : end,
    });
  }

  const trailingEdgeStart = new Date(rawFullDayEnd.getTime() + 1);
  if (trailingEdgeStart.getTime() <= end.getTime()) {
    edgeRanges.push({
      start: trailingEdgeStart.getTime() > start.getTime() ? trailingEdgeStart : start,
      end,
    });
  }

  return {
    fullDayStartUtcDay: toUtcDayBucket(rawFullDayStart),
    fullDayEndUtcDay: toUtcDayBucket(rawFullDayEnd),
    edgeRanges,
  };
}
