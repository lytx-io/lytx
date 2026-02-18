import type { SiteEventInput, DashboardOptions } from "@db/durable/types";
import { AdapterResult } from "@db/types";
import { env } from "cloudflare:workers";

export interface DurableObjectStats {
  totalEvents: number;
  eventsByType: Array<{ event: string; count: number }>;
  eventsByCountry: Array<{ country: string | null; count: number }>;
  eventsByDevice: Array<{ device_type: string | null; count: number }>;
  topReferers: Array<{ referer: string | null; count: number }>;
  siteId: number;
  dateRange: {
    start?: string;
    end?: string;
  };
}

export interface DashboardAggregates {
  scoreCards: {
    uniqueVisitors: number;
    totalPageViews: number;
    nonPageViewEvents: number;
    bounceRatePercent: number;
    conversionRatePercent: number;
    avgSessionDurationSeconds: number;
  };
  pageViews: Array<{ x: string; y: number }>;
  events: Array<[string, number]>;
  devices: Array<[string, number]>;
  cities: Array<[string, { count: number; country: string }]>;
  countries: Array<{ id: string; value: number }>;
  countryUniques: Array<{ id: string; value: number }>;
  regions: Array<{ id: string; value: number }>;
  referers: Array<{ id: string; value: number }>;
  topPages: Array<{ id: string; value: number }>;
  browsers: Array<{ id: string; value: number }>;
  operatingSystems: Array<{ id: string; value: number }>;
  pagination: { limit: number; offset: number; total: number; hasMore: boolean };
  totalEvents: number;
  totalAllTime: number;
  siteId: number | null;
  dateRange: { start?: string; end?: string };
}

function asNumberTupleRows(value: unknown): Array<[string, number]> {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row): row is [unknown, unknown] => Array.isArray(row) && row.length >= 2)
    .map((row) => [String(row[0]), Number(row[1]) || 0] as [string, number]);
}

function asCityTupleRows(value: unknown): Array<[string, { count: number; country: string }]> {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row): row is [unknown, unknown] => Array.isArray(row) && row.length >= 2)
    .map((row) => {
      const city = String(row[0]);
      const payload = row[1] as { count?: unknown; country?: unknown };
      return [
        city,
        {
          count: Number(payload?.count) || 0,
          country: typeof payload?.country === "string" ? payload.country : "Unknown",
        },
      ] as [string, { count: number; country: string }];
    });
}

export async function getDurableDatabaseStub(site_uuid: string, site_id: number) {

  const doId = env.SITE_DURABLE_OBJECT.idFromName(site_uuid);
  const durableStub = env.SITE_DURABLE_OBJECT.get(doId);
  await durableStub.setSiteInfo(site_id, site_uuid);

  return durableStub;

}
export async function getDashboardDataFromDurableObject(options: DashboardOptions): Promise<AdapterResult<"sqlite">> {
  try {
    const stub = await getDurableDatabaseStub(options.site_uuid, options.site_id);

    const data = await stub.getEventsData({
      startDate: options.date?.start,
      endDate: options.date?.end,
      limit: options.events?.limit,
      offset: options.events?.offset,
    });
    if (data.error || !data.events) {
      console.error(`Durable object request failed: ${data.error}`);
      return { query: null, client: null, noSiteRecordsExist: true, adapter: "sqlite" };
    }
    const { totalAllTime: totalAllTimeRaw, ...rest } = data;
    const totalAllTime = typeof totalAllTimeRaw === "number" ? totalAllTimeRaw : null;
    return {
      query: {
        site_id: options.site_id,
        site_uuid: options.site_uuid,
        ...rest,
        events: data.events || [],
        pagination: data.pagination || { limit: 0, offset: 0, total: 0, hasMore: false }
      },
      adapter: "sqlite",
      client: null,
      noSiteRecordsExist: totalAllTime !== null ? totalAllTime === 0 : data.events.length === 0
    };
  } catch (error) {
    console.error('Error fetching dashboard data from durable object:', error);
    return { query: null, client: null, noSiteRecordsExist: true, adapter: "sqlite" };
  }
}

export async function getStatsFromDurableObject(
  options: DashboardOptions
): Promise<DurableObjectStats | null> {
  try {
    const stub = await getDurableDatabaseStub(options.site_uuid, options.site_id);

    const data = await stub.getStats({
      startDate: options.date?.start,
      endDate: options.date?.end
    });

    if (data.error) {
      console.error(`Durable object stats request failed: ${data.error}`);
      return null;
    }

    return data as DurableObjectStats;
  } catch (error) {
    console.error('Error fetching stats from durable object:', error);
    return null;
  }
}

export async function getDashboardAggregatesFromDurableObject(
  options: DashboardOptions & {
    timezone?: string;
    country?: string;
    deviceType?: string;
    source?: string;
    pageUrl?: string;
    city?: string;
    region?: string;
    event?: string;
  },
): Promise<DashboardAggregates | null> {
  try {
    const stub = await getDurableDatabaseStub(options.site_uuid, options.site_id);

    const result = await stub.getDashboardAggregates({
      startDate: options.date?.start,
      endDate: options.date?.end,
      endDateIsExact: options.date?.endIsExact,
      timezone: options.timezone,
      country: options.country,
      deviceType: options.deviceType,
      source: options.source,
      pageUrl: options.pageUrl,
      city: options.city,
      region: options.region,
      event: options.event,
    });

    if (result.error) {
      console.error(`Durable object dashboard aggregates request failed: ${result.error}`);
      return null;
    }

    return {
      ...result,
      siteId: result.siteId ?? options.site_id,
      pageViews: result.pageViews ?? [],
      events: asNumberTupleRows(result.events),
      devices: asNumberTupleRows(result.devices),
      cities: asCityTupleRows(result.cities),
      countries: result.countries ?? [],
      countryUniques: result.countryUniques ?? [],
      referers: result.referers ?? [],
      topPages: result.topPages ?? [],
      regions: result.regions ?? [],
      browsers: result.browsers ?? [],
      operatingSystems: result.operatingSystems ?? [],
      pagination: result.pagination ?? {
        limit: 0,
        offset: 0,
        total: 0,
        hasMore: false,
      },
      scoreCards: result.scoreCards ?? {
        uniqueVisitors: 0,
        totalPageViews: 0,
        nonPageViewEvents: 0,
        bounceRatePercent: 0,
        conversionRatePercent: 0,
        avgSessionDurationSeconds: 0,
      },
      totalEvents: result.totalEvents ?? 0,
      totalAllTime: result.totalAllTime ?? 0,
      dateRange: result.dateRange ?? { start: options.date?.start?.toISOString(), end: options.date?.end?.toISOString() },
    };
  } catch (error) {
    console.error("Error fetching dashboard aggregates from durable object:", error);
    return null;
  }
}

export async function countEventsFromDurableObject(options: {
  siteId: number;
  siteUuid: string;
  startDate: Date;
  endDate?: Date;
}): Promise<number> {
  try {
    const stub = await getDurableDatabaseStub(options.siteUuid, options.siteId);
    const result = await stub.countEventsSince({
      startDate: options.startDate,
      endDate: options.endDate,
    });
    if (result?.error) {
      console.error(`Durable object count failed: ${result.error}`);
      return 0;
    }
    return result?.count ?? 0;
  } catch (error) {
    console.error("Error counting events from durable object:", error);
    return 0;
  }
}

export async function writeToDurableObject(
  siteId: number,
  siteUuid: string,
  events: SiteEventInput[],
): Promise<{ success: boolean; inserted?: number; error?: string }> {
  try {
    const stub = await getDurableDatabaseStub(siteUuid, siteId);

    const result = await stub.insertEvents(events);

    return {
      success: result.success,
      inserted: result.inserted,
      error: result.error
    };
  } catch (error) {
    console.error('Error writing to durable object:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function checkDurableObjectHealth(
  siteId: number,
  siteUuid: string
): Promise<{ status: string; siteId: number; totalEvents: number; timestamp: string } | null> {
  try {
    const stub = await getDurableDatabaseStub(siteUuid, siteId);

    const result = await stub.healthCheck();

    if (result.error) {
      console.error(`Durable object health check failed: ${result.error}`);
      return null;
    }

    return result as { status: string; siteId: number; totalEvents: number; timestamp: string };
  } catch (error) {
    console.error('Error checking durable object health:', error);
    return null;
  }
}

export async function cleanupDurableObjectEvents(
  siteId: number,
  siteUuid: string,
  olderThan: Date
): Promise<{ success: boolean; deleted?: string; error?: string }> {
  try {
    const stub = await getDurableDatabaseStub(siteUuid, siteId);

    const result = await stub.deleteEvents({
      olderThan
    });

    return {
      success: result.success,
      deleted: result.deleted,
      error: result.error
    };
  } catch (error) {
    console.error('Error cleaning up durable object events:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function getSiteInfo(
  siteId: number,
  _env: Env
): Promise<{ site_id: number; site_db_adapter: string; tag_id: string } | null> {
  try {
    return {
      site_id: siteId,
      site_db_adapter: 'sqlite',
      tag_id: `site-${siteId}-tag`
    };
  } catch (error) {
    console.error('Error getting site info:', error);
    return null;
  }
}

export async function batchWriteToDurableObjects(
  eventsBySite: Map<number, { siteUuid: string; events: SiteEventInput[] }>
): Promise<Map<number, { success: boolean; inserted?: number; error?: string }>> {
  const results = new Map();

  const promises = Array.from(eventsBySite.entries()).map(async ([siteId, { siteUuid, events }]) => {
    const result = await writeToDurableObject(siteId, siteUuid, events);
    return [siteId, result] as const;
  });

  const settledResults = await Promise.allSettled(promises);

  settledResults.forEach((result, index) => {
    const siteId = Array.from(eventsBySite.keys())[index];
    if (result.status === 'fulfilled') {
      results.set(result.value[0], result.value[1]);
    } else {
      results.set(siteId, {
        success: false,
        error: `Batch write failed: ${result.reason}`
      });
    }
  });

  return results;
}

export async function getTimeSeriesFromDurableObject(
  options: DashboardOptions & {
    granularity?: 'hour' | 'day' | 'week' | 'month';
    byEvent?: boolean;
  }
): Promise<{
  data: Array<{ date: string; count: number; event?: string }>;
  granularity: string;
  byEvent: boolean;
  siteId: number;
  dateRange: { start?: string; end?: string };
} | null> {
  try {
    const stub = await getDurableDatabaseStub(options.site_uuid, options.site_id);

    const result = await stub.getTimeSeries({
      startDate: options.date?.start,
      endDate: options.date?.end,
      granularity: options.granularity,
      byEvent: options.byEvent
    });

    if (result.error) {
      console.error(`Durable object time series request failed: ${result.error}`);
      return null;
    }

    return result as {
      data: Array<{ date: string; count: number; event?: string }>;
      granularity: string;
      byEvent: boolean;
      siteId: number;
      dateRange: { start?: string; end?: string };
    };
  } catch (error) {
    console.error('Error fetching time series from durable object:', error);
    return null;
  }
}

export async function getMetricsFromDurableObject(
  options: DashboardOptions & {
    metricType: 'events' | 'countries' | 'devices' | 'referers' | 'pages';
    limit?: number;
  }
): Promise<{
  metricType: string;
  data: Array<{ label: string; count: number }>;
  siteId: number;
  dateRange: { start?: string; end?: string };
} | null> {
  try {
    const stub = await getDurableDatabaseStub(options.site_uuid, options.site_id);

    const result = await stub.getMetrics({
      startDate: options.date?.start,
      endDate: options.date?.end,
      metricType: options.metricType,
      limit: options.limit
    });

    if (result.error) {
      console.error(`Durable object metrics request failed: ${result.error}`);
      return null;
    }

    return {
      ...result,
      siteId: result.siteId ?? options.site_id
    } as { metricType: string; data: Array<{ label: string; count: number }>; siteId: number; dateRange: { start?: string; end?: string } };
  } catch (error) {
    console.error('Error fetching metrics from durable object:', error);
    return null;
  }
}

export async function getEventSummaryFromDurableObject(
  options: DashboardOptions & {
    limit?: number;
    offset?: number;
    search?: string;
    type?: "all" | "autocapture" | "event_capture" | "page_view";
    action?: "all" | "click" | "submit" | "change" | "rule";
    sortBy?: "count" | "first_seen" | "last_seen";
    sortDirection?: "asc" | "desc";
  }
): Promise<{
  summary: Array<{ event: string | null; count: number; firstSeen: string | null; lastSeen: string | null }>;
  pagination: { offset: number; limit: number; total: number; hasMore: boolean };
  totalEvents: number;
  totalEventTypes: number;
  siteId: number | null;
  dateRange: { start?: string; end?: string };
} | null> {
  try {
    const stub = await getDurableDatabaseStub(options.site_uuid, options.site_id);

    const result = await stub.getEventSummary({
      startDate: options.date?.start,
      endDate: options.date?.end,
      endDateIsExact: options.date?.endIsExact,
      limit: options.limit,
      offset: options.offset,
      search: options.search,
      type: options.type,
      action: options.action,
      sortBy: options.sortBy,
      sortDirection: options.sortDirection,
    });

    if (result.error) {
      console.error(`Durable object event summary request failed: ${result.error}`);
      return null;
    }

    const summaryItems = (result.summary ?? []) as Array<{
      event?: string | null;
      count: number;
      firstSeen?: number | string | Date | null;
      lastSeen?: number | string | Date | null;
    }>;

    return {
      ...result,
      summary: summaryItems.map((item) => ({
        event: item.event ?? null,
        count: item.count,
        firstSeen: item.firstSeen ? new Date(item.firstSeen).toISOString() : null,
        lastSeen: item.lastSeen ? new Date(item.lastSeen).toISOString() : null,
      })),
      siteId: result.siteId ?? options.site_id
    };
  } catch (error) {
    console.error('Error fetching event summary from durable object:', error);
    return null;
  }
}
