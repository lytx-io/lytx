//! Helpers for caching historical analytics results inside a site Durable Object.

const ONE_MINUTE_MS = 60 * 1000;
const ONE_HOUR_MS = 60 * ONE_MINUTE_MS;
const DEFAULT_MAX_ENTRIES = 128;
const ANALYTICS_RESULT_CACHE_VERSION = 1;

export type AnalyticsResultCacheKind = "dashboard-aggregates" | "event-summary";
const ANALYTICS_RESULT_KV_PREFIX = "analytics-cache:v1:";

export type AnalyticsResultCacheEntry<T> = {
  expiresAt: number;
  value: T;
};

export interface AnalyticsResultCachePersistence {
  get<T>(
    kind: AnalyticsResultCacheKind,
    key: string,
  ): Promise<AnalyticsResultCacheEntry<T> | null>;
  set<T>(
    kind: AnalyticsResultCacheKind,
    key: string,
    entry: AnalyticsResultCacheEntry<T>,
  ): Promise<void>;
}

type HistoricalCacheWindow = {
  endDate?: Date;
  timezone?: string | null;
  now?: Date;
};

type AnalyticsCacheKeyPartValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Record<string, unknown>;

const noopAnalyticsResultCachePersistence: AnalyticsResultCachePersistence = {
  async get() {
    return null;
  },
  async set() {},
};

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function getEventsKvNamespace(envValue: unknown): KVNamespace | null {
  if (!envValue || typeof envValue !== "object") return null;
  const candidate = (envValue as { LYTX_EVENTS?: unknown }).LYTX_EVENTS;
  if (!candidate || typeof candidate !== "object") return null;

  if (
    typeof (candidate as KVNamespace).get !== "function"
    || typeof (candidate as KVNamespace).put !== "function"
  ) {
    return null;
  }

  return candidate as KVNamespace;
}

class EventsKvAnalyticsResultCachePersistence implements AnalyticsResultCachePersistence {
  constructor(private readonly kv: KVNamespace) {}

  async get<T>(
    kind: AnalyticsResultCacheKind,
    key: string,
  ): Promise<AnalyticsResultCacheEntry<T> | null> {
    const storageKey = await this.toStorageKey(kind, key);
    const result = await this.kv.get<AnalyticsResultCacheEntry<T>>(storageKey, "json");
    if (!result || typeof result !== "object") return null;

    const expiresAt = (result as { expiresAt?: unknown }).expiresAt;
    if (typeof expiresAt !== "number") return null;

    return {
      expiresAt,
      value: (result as AnalyticsResultCacheEntry<T>).value,
    };
  }

  async set<T>(
    kind: AnalyticsResultCacheKind,
    key: string,
    entry: AnalyticsResultCacheEntry<T>,
  ): Promise<void> {
    const ttlSeconds = Math.max(0, Math.ceil((entry.expiresAt - Date.now()) / 1000));
    if (ttlSeconds <= 0) return;

    const storageKey = await this.toStorageKey(kind, key);
    await this.kv.put(storageKey, JSON.stringify(entry), {
      expirationTtl: ttlSeconds,
    });
  }

  private async toStorageKey(kind: AnalyticsResultCacheKind, key: string): Promise<string> {
    const hash = await sha256Hex(key);
    return `${ANALYTICS_RESULT_KV_PREFIX}${kind}:${hash}`;
  }
}

function normalizeTimeZone(timezone?: string | null): string {
  if (typeof timezone !== "string") return "UTC";
  const trimmed = timezone.trim();
  if (!trimmed) return "UTC";

  try {
    Intl.DateTimeFormat(undefined, { timeZone: trimmed });
    return trimmed;
  } catch {
    return "UTC";
  }
}

function getDateBucketInTimeZone(date: Date, timezone?: string | null): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: normalizeTimeZone(timezone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    return date.toISOString().slice(0, 10);
  }

  return `${year}-${month}-${day}`;
}

function parseDateBucket(bucket: string): number {
  const [year, month, day] = bucket.split("-").map((value) => Number(value));
  return Date.UTC(year, month - 1, day);
}

function normalizeKeyPart(value: AnalyticsCacheKeyPartValue): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeKeyPart(item as AnalyticsCacheKeyPartValue));
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value).toSorted(([left], [right]) => left.localeCompare(right));
    return Object.fromEntries(
      entries.map(([key, innerValue]) => [key, normalizeKeyPart(innerValue as AnalyticsCacheKeyPartValue)]),
    );
  }
  return value ?? null;
}

export function isHistoricalAnalyticsRange({
  endDate,
  timezone,
  now = new Date(),
}: HistoricalCacheWindow): boolean {
  if (!endDate) return false;
  const todayBucket = getDateBucketInTimeZone(now, timezone);
  const endBucket = getDateBucketInTimeZone(endDate, timezone);
  return endBucket < todayBucket;
}

export function getHistoricalAnalyticsCacheTtlMs(input: HistoricalCacheWindow): number {
  if (!isHistoricalAnalyticsRange(input)) return 0;

  const todayBucket = getDateBucketInTimeZone(input.now ?? new Date(), input.timezone);
  const endBucket = getDateBucketInTimeZone(input.endDate!, input.timezone);
  const diffDays = Math.max(
    0,
    Math.round((parseDateBucket(todayBucket) - parseDateBucket(endBucket)) / (24 * ONE_HOUR_MS)),
  );

  if (diffDays <= 1) return 5 * ONE_MINUTE_MS;
  if (diffDays <= 7) return 15 * ONE_MINUTE_MS;
  return ONE_HOUR_MS;
}

export function buildAnalyticsResultCacheKey(
  kind: AnalyticsResultCacheKind,
  parts: Record<string, AnalyticsCacheKeyPartValue>,
): string {
  return JSON.stringify({
    version: ANALYTICS_RESULT_CACHE_VERSION,
    kind,
    parts: normalizeKeyPart(parts),
  });
}

export function createAnalyticsResultCachePersistence(_env: unknown): AnalyticsResultCachePersistence {
  const kv = getEventsKvNamespace(_env);
  if (!kv) return noopAnalyticsResultCachePersistence;
  return new EventsKvAnalyticsResultCachePersistence(kv);
}

export class HistoricalAnalyticsResultMemoryCache {
  private readonly entries = new Map<string, AnalyticsResultCacheEntry<unknown>>();

  constructor(private readonly maxEntries: number = DEFAULT_MAX_ENTRIES) {}

  get<T>(key: string, now = Date.now()): AnalyticsResultCacheEntry<T> | null {
    const entry = this.entries.get(key);
    if (!entry) return null;

    if (entry.expiresAt <= now) {
      this.entries.delete(key);
      return null;
    }

    // Reinsert on hit to keep frequently used entries hot.
    this.entries.delete(key);
    this.entries.set(key, entry);

    return entry as AnalyticsResultCacheEntry<T>;
  }

  set<T>(key: string, entry: AnalyticsResultCacheEntry<T>) {
    if (entry.expiresAt <= Date.now()) return;

    this.entries.delete(key);
    this.entries.set(key, entry as AnalyticsResultCacheEntry<unknown>);
    this.trimToMaxEntries();
  }

  clear() {
    this.entries.clear();
  }

  private trimToMaxEntries() {
    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (!oldestKey) return;
      this.entries.delete(oldestKey);
    }
  }
}
