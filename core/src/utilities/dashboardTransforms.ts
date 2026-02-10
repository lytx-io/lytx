export type DateRangeFilter = {
  start?: Date;
  end?: Date;
};

export function isWithinDateRange(date: Date, range?: DateRangeFilter): boolean {
  if (range?.start && date < range.start) return false;
  if (range?.end && date > range.end) return false;
  return true;
}

export function filterByDateRange<T>(
  items: T[],
  getDate: (item: T) => Date | null | undefined,
  range?: DateRangeFilter,
): T[] {
  if (!range?.start && !range?.end) return items;
  return items.filter((item) => {
    const date = getDate(item);
    if (!date) return false;
    return isWithinDateRange(date, range);
  });
}

export function toDateKey(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function countBy<T, K>(
  items: T[],
  getKey: (item: T) => K | null | undefined,
): Map<K, number> {
  const map = new Map<K, number>();

  for (const item of items) {
    const key = getKey(item);
    if (key === null || key === undefined) continue;
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  return map;
}

export function countDistinctBy<T, K>(
  items: T[],
  getKey: (item: T) => K | null | undefined,
): number {
  const set = new Set<K>();
  for (const item of items) {
    const key = getKey(item);
    if (key === null || key === undefined) continue;
    set.add(key);
  }
  return set.size;
}

export function mapToSortedEntries<K>(
  map: Map<K, number>,
  options?: { direction?: "asc" | "desc"; limit?: number },
): Array<[K, number]> {
  const direction = options?.direction ?? "desc";
  const entries = Array.from(map.entries()).sort((a, b) =>
    direction === "desc" ? b[1] - a[1] : a[1] - b[1],
  );
  return typeof options?.limit === "number" ? entries.slice(0, options.limit) : entries;
}

export function formatPercent(value: number, decimals: number): string {
  if (!Number.isFinite(value)) return `0.${"0".repeat(decimals)}%`;
  return `${value.toFixed(decimals)}%`;
}

export function formatDurationSeconds(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return "0s";

  const wholeSeconds = Math.floor(totalSeconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const seconds = wholeSeconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

export function cleanReferer(referer: unknown): string {
  if (!referer || referer === "" || referer === "null") {
    return "Direct";
  }

  const value = String(referer);

  try {
    const url = new URL(value);
    return url.hostname;
  } catch {
    const hostname = value.replace(/^https?:\/\//, "").replace(/\/.*/, "");
    if (hostname.length === 0) return "Direct";
    return hostname.length > 50 ? `${hostname.substring(0, 47)}...` : hostname;
  }
}

export function cleanPageUrl(url: unknown): string {
  if (!url || url === "" || url === "null") {
    return "Unknown";
  }

  const value = String(url);

  try {
    const urlObj = new URL(value);
    return urlObj.pathname + (urlObj.search ? urlObj.search : "");
  } catch {
    return value.length > 50 ? `${value.substring(0, 47)}...` : value;
  }
}

export function serializeForClient<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_key, value) => {
      if (value instanceof Date) {
        return value.toISOString();
      }
      if (value === undefined) {
        return null;
      }
      return value;
    }),
  );
}

export function calculateAverageSessionDurationSeconds<T>(
  events: T[],
  selectors: {
    getSessionId: (event: T) => string | null | undefined;
    getTimestamp: (event: T) => Date | null | undefined;
  },
): number {
  const sessionTimes = new Map<string, { first: Date; last: Date }>();

  for (const event of events) {
    const sessionId = selectors.getSessionId(event);
    const timestamp = selectors.getTimestamp(event);
    if (!sessionId || !timestamp) continue;

    const existing = sessionTimes.get(sessionId);
    if (!existing) {
      sessionTimes.set(sessionId, { first: timestamp, last: timestamp });
      continue;
    }

    if (timestamp < existing.first) existing.first = timestamp;
    if (timestamp > existing.last) existing.last = timestamp;
  }

  if (sessionTimes.size === 0) return 0;

  let durationSumSeconds = 0;
  for (const { first, last } of sessionTimes.values()) {
    durationSumSeconds += (last.getTime() - first.getTime()) / 1000;
  }

  return durationSumSeconds / sessionTimes.size;
}


