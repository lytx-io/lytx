import { DurableObject } from "cloudflare:workers";
import { drizzle, DrizzleSqliteDODatabase } from 'drizzle-orm/durable-sqlite';
import { eq, and, gte, lte, desc, asc, count, sql, isNotNull, ne, like, or, isNull, not } from "drizzle-orm";
import { siteEvents, type SiteEventInsert, type SiteEventSelect } from '@db/durable/schema';
import { migrate } from 'drizzle-orm/durable-sqlite/migrator';
//TODO: generate durable object migrations
import * as schema from "@db/durable/schema";
import migrations from '@db/durable/migrations/migrations';
import { SiteEventInput } from './types';
import type { GetEventsOptions, Durable_DB } from "@db/durable/types";
import { events_t, getEvents, type GetEventResult } from "@db/durable/events";
import { getSiteRidConfig, rotateSiteRidSalt } from "@db/d1/sites";
//TODO: Move this type

const MAX_SQL_ROWS = 500;
const SQL_ALLOWED_PREFIX = /^(select|with)\s/i;
const SQL_FORBIDDEN_PATTERN = /\b(insert|update|delete|drop|alter|create|pragma|attach|detach|replace|truncate)\b/i;
const SQL_REQUIRED_TABLE = /\bsite_events\b/i;

/** Adjusts end date to include the entire day (23:59:59.999 UTC) */
function getEndOfDay(date: Date): Date {
  const endOfDay = new Date(date);
  endOfDay.setUTCHours(23, 59, 59, 999);
  return endOfDay;
}

/** Returns getEndOfDay(date) unless isExact is true, in which case returns date as-is. */
function resolveEndDate(date: Date, isExact?: boolean): Date {
  return isExact ? date : getEndOfDay(date);
}

function normalizeTimeZone(timeZone?: string | null): string {
  if (typeof timeZone !== "string") return "UTC";
  const trimmed = timeZone.trim();
  if (!trimmed) return "UTC";

  try {
    Intl.DateTimeFormat(undefined, { timeZone: trimmed });
    return trimmed;
  } catch {
    return "UTC";
  }
}

function createDateBucketFormatter(timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return (date: Date): string => {
    const parts = formatter.formatToParts(date);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;

    if (!year || !month || !day) {
      return date.toISOString().slice(0, 10);
    }

    return `${year}-${month}-${day}`;
  };
}

function normalizeSqlQuery(query: string) {
  return query.trim().replace(/;\s*$/, "");
}

function validateSqlQuery(query: string): string | null {
  if (!query) return "Query is required";
  if (query.includes(";")) return "Multiple statements are not allowed";
  if (!SQL_ALLOWED_PREFIX.test(query)) return "Only SELECT queries are allowed";
  if (SQL_FORBIDDEN_PATTERN.test(query)) return "Only read-only SELECT queries are allowed";
  if (!SQL_REQUIRED_TABLE.test(query)) return "Query must reference site_events";
  return null;
}

/**
 * Site-specific Durable Object for storing and querying site events
 * 
 * Each instance represents a single site and contains all event data for that site.
 * Naming convention: Site-{site_id} (e.g., Site-123)
 */
export class SiteDurableObject extends DurableObject {
  private db: Durable_DB;
  private state!: DurableObjectState;
  private site_id: number | null = null;
  private site_uuid: string | null = null;

  constructor(state: DurableObjectState, env: any) {
    super(state, env);
    this.state = state;
    // Use the SQL storage from the durable object state
    // this.db = drizzle(state.storage);
    this.db = drizzle(state.storage, {
      schema,
      //logger: true 
    });

    state.blockConcurrencyWhile(async () => {
      await this._migrate();
    });

  }

  async setSiteInfo(site_id: number, site_uuid: string) {
    this.site_id = site_id;
    this.site_uuid = site_uuid;
    await this.scheduleRidSaltAlarm();
  }

  private async scheduleRidSaltAlarm() {
    if (!this.site_id) return;
    try {
      const ridConfig = await getSiteRidConfig(this.site_id);
      if (!ridConfig) return;
      const rawExpire = ridConfig.rid_salt_expire ? new Date(ridConfig.rid_salt_expire) : null;
      if (!rawExpire || Number.isNaN(rawExpire.getTime())) {
        const rotated = await rotateSiteRidSalt(this.site_id);
        if (rotated?.rid_salt_expire) {
          await this.state.storage.setAlarm(rotated.rid_salt_expire);
        }
        return;
      }
      if (rawExpire <= new Date()) {
        const rotated = await rotateSiteRidSalt(this.site_id);
        if (rotated?.rid_salt_expire) {
          await this.state.storage.setAlarm(rotated.rid_salt_expire);
        }
        return;
      }
      await this.state.storage.setAlarm(rawExpire);
    } catch (error) {
      if (this.env.ENVIRONMENT === "development") {
        console.error(`SiteDurableObject scheduleRidSaltAlarm error for site ${this.site_id}:`, error);
      }
    }
  }

  async alarm() {
    if (!this.site_id) return;
    try {
      const ridConfig = await getSiteRidConfig(this.site_id);
      if (!ridConfig) return;
      const rawExpire = ridConfig.rid_salt_expire ? new Date(ridConfig.rid_salt_expire) : null;
      if (!rawExpire || Number.isNaN(rawExpire.getTime()) || rawExpire <= new Date()) {
        const rotated = await rotateSiteRidSalt(this.site_id);
        if (rotated?.rid_salt_expire) {
          await this.state.storage.setAlarm(rotated.rid_salt_expire);
        }
        return;
      }
      await this.state.storage.setAlarm(rawExpire);
    } catch (error) {
      if (this.env.ENVIRONMENT === "development") {
        console.error(`SiteDurableObject alarm error for site ${this.site_id}:`, error);
      }
    }
  }

  async _migrate() {
    migrate(this.db, migrations);
  }

  async fetch(_request: Request): Promise<Response> {
    // Fallback fetch method for compatibility
    return new Response('Use RPC methods instead of fetch', { status: 501 });
  }

  /**
   * Insert new events into the site's storage
   */
  async insertEvents(events: SiteEventInput[]) {
    try {
      if (!this.site_id) {
        return {
          success: false,
          inserted: 0,
          siteId: this.site_id,
          error: "Site not initialized",
        };
      }

      if (events.length === 0) {
        return {
          success: false,
          inserted: 0,
          siteId: this.site_id,
          error: "No events provided",
        };
      }

      // Transform input events to database format
      const dbEvents: SiteEventInsert[] = events.map((event) => ({
        bot_data: event.bot_data as Record<string, string> | null,
        browser: event.browser || null,
        city: event.city || null,
        client_page_url: event.client_page_url || null,
        country: event.country || null,
        custom_data: event.custom_data as Record<string, string> | null,
        device_type: event.device_type || null,
        event: event.event,
        operating_system: event.operating_system || null,
        page_url: event.page_url || null,
        postal: event.postal || null,
        query_params: event.query_params as Record<string, string> | null,
        referer: event.referer || null,
        region: event.region || null,
        rid: event.rid || null,
        screen_height: event.screen_height || null,
        screen_width: event.screen_width || null,
        site_id: this.site_id as number, // Required by the durable schema
        tag_id: event.tag_id,
        createdAt: event.createdAt || new Date(),
        updatedAt: event.updatedAt || new Date(),
      }));

      // Durable Object SQLite has a 100 bound parameters limit per query
      // Each event has ~21 fields, so max 4 events per batch (4 × 21 = 84 < 100)
      const BATCH_SIZE = 4;
      let totalInserted = 0;

      for (let i = 0; i < dbEvents.length; i += BATCH_SIZE) {
        const batch = dbEvents.slice(i, i + BATCH_SIZE);
        await this.db.insert(siteEvents).values(batch);
        totalInserted += batch.length;
      }

      return {
        success: true,
        inserted: totalInserted,
        siteId: this.site_id
      };
    } catch (error) {
      if (this.env.ENVIRONMENT === "development") console.error(`SiteDurableObject insertEvents error for site ${this.site_id}:`, error);
      return {
        success: false,
        inserted: 0,
        siteId: this.site_id,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }


  async getStuff(): Promise<{ error: boolean, events: Array<{}> }> {
    const query = this.db
      .select()
      .from(siteEvents)
    const events = await query;
    return { error: false, events: events }

  }
  /**
   * Query events with filtering and pagination
   */
  async getEventsData(options: GetEventsOptions = {}) {
    if (this.env.ENVIRONMENT === "development") console.log('GRABBING EVENTS DATA FROM DURABLE getEventsData', options)
    const { error, events, pagination, totalAllTime } = await getEvents(this.db, options);
    return { error, events, pagination, totalAllTime }
  }


  /**
   * Get aggregated statistics for dashboard
   */
  async getStats(options: {
    startDate?: Date;
    endDate?: Date;
    endDateIsExact?: boolean;
  } = {}) {
    try {
      const { startDate, endDate, endDateIsExact } = options;

      // Build date filter conditions
      const conditions = [];
      if (startDate) {
        conditions.push(gte(siteEvents.createdAt, startDate));
      }
      if (endDate) {
        conditions.push(lte(siteEvents.createdAt, resolveEndDate(endDate, endDateIsExact)));
      }
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Get total events count
      const totalEventsResult = await this.db
        .select({ count: count() })
        .from(siteEvents)
        .where(whereClause);

      const totalEvents = totalEventsResult[0]?.count || 0;

      // Get events by type
      const eventsByTypeResult = await this.db
        .select({
          event: siteEvents.event,
          count: count()
        })
        .from(siteEvents)
        .where(whereClause)
        .groupBy(siteEvents.event)
        .orderBy(desc(count()))
        .limit(10);

      // Get events by country
      const eventsByCountryResult = await this.db
        .select({
          country: siteEvents.country,
          count: count()
        })
        .from(siteEvents)
        .where(whereClause)
        .groupBy(siteEvents.country)
        .orderBy(desc(count()))
        .limit(10);

      // Get events by device
      const eventsByDeviceResult = await this.db
        .select({
          device_type: siteEvents.device_type,
          count: count()
        })
        .from(siteEvents)
        .where(whereClause)
        .groupBy(siteEvents.device_type)
        .orderBy(desc(count()))
        .limit(10);

      // Get top referers
      const topReferersResult = await this.db
        .select({
          referer: siteEvents.referer,
          count: count()
        })
        .from(siteEvents)
        .where(whereClause)
        .groupBy(siteEvents.referer)
        .orderBy(desc(count()))
        .limit(10);

      return {
        totalEvents,
        eventsByType: eventsByTypeResult,
        eventsByCountry: eventsByCountryResult,
        eventsByDevice: eventsByDeviceResult,
        topReferers: topReferersResult,
        siteId: this.site_id,
        dateRange: {
          start: startDate?.toISOString(),
          end: endDate?.toISOString()
        }
      };
    } catch (error) {
      if (this.env.ENVIRONMENT === "development") console.error(`SiteDurableObject getStats error for site ${this.site_id}:`, error);
      return {
        totalEvents: 0,
        eventsByType: [],
        eventsByCountry: [],
        eventsByDevice: [],
        topReferers: [],
        siteId: this.site_id,
        dateRange: {
          start: options.startDate?.toISOString(),
          end: options.endDate?.toISOString()
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getDashboardAggregates(options: {
    startDate?: Date;
    endDate?: Date;
    endDateIsExact?: boolean;
    timezone?: string | null;
    country?: string;
    deviceType?: string;
    source?: string;
    pageUrl?: string;
    city?: string;
    region?: string;
    event?: string;
  } = {}) {
    try {
      const { startDate, endDate, endDateIsExact, timezone, country, deviceType, source, pageUrl, city, region, event } = options;
      const effectiveTimeZone = normalizeTimeZone(timezone);

      const conditions = [];
      if (startDate) {
        conditions.push(gte(siteEvents.createdAt, startDate));
      }
      if (endDate) {
        conditions.push(lte(siteEvents.createdAt, resolveEndDate(endDate, endDateIsExact)));
      }
      if (country) {
        conditions.push(eq(siteEvents.country, country));
      }
      if (deviceType) {
        conditions.push(eq(siteEvents.device_type, deviceType));
      }

      const normalizedSource = source?.trim().toLowerCase() ?? "";
      if (normalizedSource.length > 0) {
        if (normalizedSource === "direct") {
          conditions.push(
            or(
              isNull(siteEvents.referer),
              eq(siteEvents.referer, ""),
              eq(siteEvents.referer, "null"),
            ),
          );
        } else {
          conditions.push(like(siteEvents.referer, `%${normalizedSource}%`));
        }
      }

      if (pageUrl) {
        conditions.push(eq(siteEvents.client_page_url, pageUrl));
      }
      if (city) {
        conditions.push(eq(siteEvents.city, city));
      }
      if (region) {
        conditions.push(eq(siteEvents.region, region));
      }
      if (event) {
        conditions.push(eq(siteEvents.event, event));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const pageViewWhereClause = and(...conditions, eq(siteEvents.event, "page_view"));
      const sessionsWhereClause = and(
        ...conditions,
        isNotNull(siteEvents.rid),
        ne(siteEvents.rid, ""),
      );
      const conversionWhereClause = and(
        ...conditions,
        or(eq(siteEvents.event, "conversion"), eq(siteEvents.event, "purchase")),
      );

      const totalEventsResult = await this.db
        .select({ count: count() })
        .from(siteEvents)
        .where(whereClause);

      const totalAllTimeResult = await this.db
        .select({ count: count() })
        .from(siteEvents);

      const uniqueVisitorsResult = await this.db
        .select({ count: sql<number>`COUNT(DISTINCT ${siteEvents.rid})` })
        .from(siteEvents)
        .where(sessionsWhereClause);

      const totalPageViewsResult = await this.db
        .select({ count: count() })
        .from(siteEvents)
        .where(pageViewWhereClause);

      const conversionEventsResult = await this.db
        .select({ count: count() })
        .from(siteEvents)
        .where(conversionWhereClause);

      const pageViewsByRidResult = await this.db
        .select({
          rid: siteEvents.rid,
          pageViewCount: count(),
        })
        .from(siteEvents)
        .where(and(...conditions, eq(siteEvents.event, "page_view"), isNotNull(siteEvents.rid), ne(siteEvents.rid, "")))
        .groupBy(siteEvents.rid);

      const sessionDurationRows = await this.db
        .select({
          rid: siteEvents.rid,
          firstSeen: sql<number>`min(${siteEvents.createdAt}) * 1000`,
          lastSeen: sql<number>`max(${siteEvents.createdAt}) * 1000`,
        })
        .from(siteEvents)
        .where(sessionsWhereClause)
        .groupBy(siteEvents.rid);

      const pageViewHourExpr = sql<number>`CAST(${siteEvents.createdAt} / 3600 AS INTEGER) * 3600`;

      const pageViewsByHourResult = await this.db
        .select({
          hourEpoch: pageViewHourExpr,
          count: count(),
        })
        .from(siteEvents)
        .where(pageViewWhereClause)
        .groupBy(pageViewHourExpr)
        .orderBy(pageViewHourExpr);

      const formatDateBucket = createDateBucketFormatter(effectiveTimeZone);
      const pageViewsByDate = new Map<string, number>();

      for (const item of pageViewsByHourResult) {
        const hourEpoch = Number(item.hourEpoch);
        if (!Number.isFinite(hourEpoch)) continue;
        const bucketDate = formatDateBucket(new Date(hourEpoch * 1000));
        pageViewsByDate.set(bucketDate, (pageViewsByDate.get(bucketDate) ?? 0) + item.count);
      }

      const pageViews = Array.from(pageViewsByDate.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([x, y]) => ({ x, y }));

      const eventsByTypeResult = await this.db
        .select({
          event: siteEvents.event,
          count: count(),
        })
        .from(siteEvents)
        .where(whereClause)
        .groupBy(siteEvents.event)
        .orderBy(desc(count()))
        .limit(100);

      const devicesResult = await this.db
        .select({
          deviceType: siteEvents.device_type,
          count: count(),
        })
        .from(siteEvents)
        .where(pageViewWhereClause)
        .groupBy(siteEvents.device_type)
        .orderBy(desc(count()))
        .limit(25);

      const browsersResult = await this.db
        .select({
          browser: siteEvents.browser,
          count: count(),
        })
        .from(siteEvents)
        .where(pageViewWhereClause)
        .groupBy(siteEvents.browser)
        .orderBy(desc(count()))
        .limit(25);

      const operatingSystemsResult = await this.db
        .select({
          os: siteEvents.operating_system,
          count: count(),
        })
        .from(siteEvents)
        .where(pageViewWhereClause)
        .groupBy(siteEvents.operating_system)
        .orderBy(desc(count()))
        .limit(25);

      const referersResult = await this.db
        .select({
          referer: siteEvents.referer,
          count: count(),
        })
        .from(siteEvents)
        .where(pageViewWhereClause)
        .groupBy(siteEvents.referer)
        .orderBy(desc(count()))
        .limit(100);

      const topPagesResult = await this.db
        .select({
          page: siteEvents.client_page_url,
          count: count(),
        })
        .from(siteEvents)
        .where(pageViewWhereClause)
        .groupBy(siteEvents.client_page_url)
        .orderBy(desc(count()))
        .limit(100);

      const citiesResult = await this.db
        .select({
          city: siteEvents.city,
          country: siteEvents.country,
          count: count(),
        })
        .from(siteEvents)
        .where(pageViewWhereClause)
        .groupBy(siteEvents.city, siteEvents.country)
        .orderBy(desc(count()))
        .limit(100);

      const countriesResult = await this.db
        .select({
          country: siteEvents.country,
          count: count(),
        })
        .from(siteEvents)
        .where(pageViewWhereClause)
        .groupBy(siteEvents.country)
        .orderBy(desc(count()))
        .limit(250);

      const countryUniquesResult = await this.db
        .select({
          country: siteEvents.country,
          count: sql<number>`COUNT(DISTINCT ${siteEvents.rid})`,
        })
        .from(siteEvents)
        .where(and(pageViewWhereClause, isNotNull(siteEvents.rid), ne(siteEvents.rid, "")))
        .groupBy(siteEvents.country)
        .orderBy(desc(sql<number>`COUNT(DISTINCT ${siteEvents.rid})`))
        .limit(250);

      const regionsResult = await this.db
        .select({
          region: siteEvents.region,
          count: count(),
        })
        .from(siteEvents)
        .where(pageViewWhereClause)
        .groupBy(siteEvents.region)
        .orderBy(desc(count()))
        .limit(100);

      const totalEvents = totalEventsResult[0]?.count || 0;
      const totalAllTime = totalAllTimeResult[0]?.count || 0;
      const uniqueVisitors = uniqueVisitorsResult[0]?.count || 0;
      const totalPageViews = totalPageViewsResult[0]?.count || 0;
      const nonPageViewEvents = Math.max(0, totalEvents - totalPageViews);
      const conversionEvents = conversionEventsResult[0]?.count || 0;

      const singlePageSessions = pageViewsByRidResult.filter((row) => row.pageViewCount === 1).length;
      const bounceRatePercent = uniqueVisitors > 0
        ? Number(((singlePageSessions / uniqueVisitors) * 100).toFixed(1))
        : 0;
      const conversionRatePercent = uniqueVisitors > 0
        ? Number(((conversionEvents / uniqueVisitors) * 100).toFixed(2))
        : 0;

      const totalDurationSeconds = sessionDurationRows.reduce((acc, row) => {
        const firstSeen = row.firstSeen ?? 0;
        const lastSeen = row.lastSeen ?? 0;
        if (!firstSeen || !lastSeen) return acc;
        const duration = Math.max(0, (lastSeen - firstSeen) / 1000);
        return acc + duration;
      }, 0);
      const avgSessionDurationSeconds = sessionDurationRows.length > 0
        ? totalDurationSeconds / sessionDurationRows.length
        : 0;

      return {
        scoreCards: {
          uniqueVisitors,
          totalPageViews,
          nonPageViewEvents,
          bounceRatePercent,
          conversionRatePercent,
          avgSessionDurationSeconds,
        },
        pageViews,
        events: eventsByTypeResult.map((item) => [item.event ?? "Unknown", item.count] as [string, number]),
        devices: devicesResult.map((item) => [item.deviceType ?? "Unknown", item.count] as [string, number]),
        cities: citiesResult.map((item) => [
          item.city ?? "Unknown",
          {
            count: item.count,
            country: item.country ?? "Unknown",
          },
        ] as [string, { count: number; country: string }]),
        countries: countriesResult
          .filter((item) => !!item.country)
          .map((item) => ({
            id: item.country!,
            value: item.count,
          })),
        countryUniques: countryUniquesResult
          .filter((item) => !!item.country)
          .map((item) => ({
            id: item.country!,
            value: item.count,
          })),
        regions: regionsResult
          .filter((item) => !!item.region)
          .map((item) => ({
            id: item.region!,
            value: item.count,
          })),
        referers: referersResult.map((item) => ({
          id: item.referer ?? "Direct",
          value: item.count,
        })),
        topPages: topPagesResult.map((item) => ({
          id: item.page ?? "Unknown",
          value: item.count,
        })),
        browsers: browsersResult.map((item) => ({
          id: item.browser ?? "Unknown",
          value: item.count,
        })),
        operatingSystems: operatingSystemsResult
          .filter((item) => !!item.os)
          .map((item) => ({
            id: item.os ?? "Unknown",
            value: item.count,
          })),
        pagination: {
          limit: 0,
          offset: 0,
          total: totalEvents,
          hasMore: false,
        },
        totalEvents,
        totalAllTime,
        siteId: this.site_id,
        dateRange: {
          start: startDate?.toISOString(),
          end: endDate?.toISOString(),
        },
      };
    } catch (error) {
      if (this.env.ENVIRONMENT === "development") {
        console.error(`SiteDurableObject getDashboardAggregates error for site ${this.site_id}:`, error);
      }

      return {
        scoreCards: {
          uniqueVisitors: 0,
          totalPageViews: 0,
          nonPageViewEvents: 0,
          bounceRatePercent: 0,
          conversionRatePercent: 0,
          avgSessionDurationSeconds: 0,
        },
        pageViews: [],
        events: [],
        devices: [],
        cities: [],
        countries: [],
        countryUniques: [],
        referers: [],
        topPages: [],
        browsers: [],
        operatingSystems: [],
        pagination: {
          limit: 0,
          offset: 0,
          total: 0,
          hasMore: false,
        },
        totalEvents: 0,
        totalAllTime: 0,
        siteId: this.site_id,
        dateRange: {
          start: options.startDate?.toISOString(),
          end: options.endDate?.toISOString(),
        },
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Summarize events by name
   */
  async getEventSummary(options: {
    startDate?: Date;
    endDate?: Date;
    endDateIsExact?: boolean;
    limit?: number;
    offset?: number;
    search?: string;
    type?: "all" | "autocapture" | "event_capture" | "page_view";
    action?: "all" | "click" | "submit" | "change" | "rule";
    sortBy?: "count" | "first_seen" | "last_seen";
    sortDirection?: "asc" | "desc";
  } = {}) {
    try {
      const { startDate, endDate, endDateIsExact } = options;

      const conditions = [];
      if (startDate) {
        conditions.push(gte(siteEvents.createdAt, startDate));
      }
      if (endDate) {
        conditions.push(lte(siteEvents.createdAt, resolveEndDate(endDate, endDateIsExact)));
      }
      if (options.search) {
        const trimmedSearch = options.search.trim();
        if (trimmedSearch.length > 0) {
          conditions.push(like(siteEvents.event, `%${trimmedSearch}%`));
        }
      }

      if (options.type === "autocapture") {
        conditions.push(or(like(siteEvents.event, "$ac_%"), eq(siteEvents.event, "auto_capture")));
      } else if (options.type === "event_capture") {
        conditions.push(
          and(
            isNotNull(siteEvents.event),
            ne(siteEvents.event, "page_view"),
            ne(siteEvents.event, "auto_capture"),
            not(like(siteEvents.event, "$ac_%")),
          ),
        );
      } else if (options.type === "page_view") {
        conditions.push(eq(siteEvents.event, "page_view"));
      }

      if (options.action === "rule") {
        conditions.push(eq(siteEvents.event, "auto_capture"));
      } else if (options.action === "submit") {
        conditions.push(like(siteEvents.event, "$ac_form_%"));
      } else if (options.action === "change") {
        conditions.push(like(siteEvents.event, "$ac_input_%"));
      } else if (options.action === "click") {
        conditions.push(
          and(
            like(siteEvents.event, "$ac_%"),
            not(like(siteEvents.event, "$ac_form_%")),
            not(like(siteEvents.event, "$ac_input_%")),
          ),
        );
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const limit = Math.min(Math.max(1, options.limit ?? 50), 500);
      const offset = Math.max(0, options.offset ?? 0);
      const sortBy = options.sortBy ?? "count";
      const sortDirection = options.sortDirection === "asc" ? "asc" : "desc";

      const countExpression = count();
      const firstSeenExpression = sql<number>`min(${siteEvents.createdAt}) * 1000`;
      const lastSeenExpression = sql<number>`max(${siteEvents.createdAt}) * 1000`;

      const sortExpression =
        sortBy === "first_seen"
          ? firstSeenExpression
          : sortBy === "last_seen"
            ? lastSeenExpression
            : countExpression;
      const primarySort = sortDirection === "asc" ? asc(sortExpression) : desc(sortExpression);
      const secondarySort = sortBy === "count" ? desc(lastSeenExpression) : desc(countExpression);

      const summary = await this.db
        .select({
          event: siteEvents.event,
          count: countExpression,
          // Multiply by 1000 to convert Unix seconds to milliseconds for JavaScript Date
          firstSeen: firstSeenExpression,
          lastSeen: lastSeenExpression,
        })
        .from(siteEvents)
        .where(whereClause)
        .groupBy(siteEvents.event)
        .orderBy(primarySort, secondarySort, asc(siteEvents.event))
        .limit(limit)
        .offset(offset);

      const totalEventsResult = await this.db
        .select({ count: count() })
        .from(siteEvents)
        .where(whereClause);

      const totalEventTypesResult = await this.db
        .select({ count: sql<number>`COUNT(DISTINCT ${siteEvents.event})` })
        .from(siteEvents)
        .where(whereClause);

      const totalEvents = totalEventsResult[0]?.count || 0;
      const totalEventTypes = totalEventTypesResult[0]?.count || 0;

      return {
        summary,
        pagination: {
          offset,
          limit,
          total: totalEventTypes,
          hasMore: offset + limit < totalEventTypes,
        },
        totalEvents,
        totalEventTypes,
        siteId: this.site_id,
        dateRange: {
          start: startDate?.toISOString(),
          end: endDate?.toISOString(),
        },
      };
    } catch (error) {
      if (this.env.ENVIRONMENT === "development") console.error(`SiteDurableObject getEventSummary error for site ${this.site_id}:`, error);
      return {
        summary: [],
        pagination: {
          offset: options.offset ?? 0,
          limit: options.limit ?? 50,
          total: 0,
          hasMore: false,
        },
        totalEvents: 0,
        totalEventTypes: 0,
        siteId: this.site_id,
        dateRange: {
          start: options.startDate?.toISOString(),
          end: options.endDate?.toISOString(),
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get time series data for line charts
   */
  async getTimeSeries(options: {
    startDate?: Date;
    endDate?: Date;
    endDateIsExact?: boolean;
    granularity?: 'hour' | 'day' | 'week' | 'month';
    byEvent?: boolean;
  } = {}) {
    try {
      const { startDate, endDate, endDateIsExact, granularity = 'day', byEvent = false } = options;

      // Build date filter conditions
      const conditions = [];
      if (startDate) {
        conditions.push(gte(siteEvents.createdAt, startDate));
      }
      if (endDate) {
        conditions.push(lte(siteEvents.createdAt, resolveEndDate(endDate, endDateIsExact)));
      }
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Build time series query based on granularity
      let dateFormat: string;
      switch (granularity) {
        case 'hour':
          dateFormat = '%Y-%m-%d %H:00:00';
          break;
        case 'week':
          dateFormat = '%Y-W%W';
          break;
        case 'month':
          dateFormat = '%Y-%m';
          break;
        default:
          dateFormat = '%Y-%m-%d';
      }

      const timeBucketExpr = sql<string>`strftime(${dateFormat}, ${siteEvents.createdAt}, 'unixepoch')`;

      let query;
      if (byEvent) {
        query = this.db
          .select({
            date: timeBucketExpr.as('date'),
            event: siteEvents.event,
            count: count()
          })
          .from(siteEvents)
          .where(whereClause)
          .groupBy(timeBucketExpr, siteEvents.event)
          .orderBy(timeBucketExpr);
      } else {
        query = this.db
          .select({
            date: timeBucketExpr.as('date'),
            count: count()
          })
          .from(siteEvents)
          .where(whereClause)
          .groupBy(timeBucketExpr)
          .orderBy(timeBucketExpr);
      }

      const data = await query;

      return {
        data,
        granularity,
        byEvent,
        siteId: this.site_id,
        dateRange: {
          start: startDate?.toISOString(),
          end: endDate?.toISOString()
        }
      };
    } catch (error) {
      if (this.env.ENVIRONMENT === "development") console.error(`SiteDurableObject getTimeSeries error for site ${this.site_id}:`, error);
      return {
        data: [],
        granularity: options.granularity || 'day',
        byEvent: options.byEvent || false,
        siteId: this.site_id,
        dateRange: {
          start: options.startDate?.toISOString(),
          end: options.endDate?.toISOString()
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async runSqlQuery(query: string, options: { limit?: number } = {}) {
    const normalized = normalizeSqlQuery(query);
    const validationError = validateSqlQuery(normalized);

    if (validationError) {
      return {
        success: false,
        error: validationError,
      };
    }

    const limit = Math.min(options.limit ?? MAX_SQL_ROWS, MAX_SQL_ROWS);
    // Check if query already has a LIMIT clause (handles "LIMIT 50" at end or "LIMIT 50 OFFSET 10")
    const hasLimit = /\blimit\s+\d+/i.test(normalized);
    const limitedQuery = hasLimit
      ? normalized
      : `${normalized} LIMIT ${limit}`;

    try {
      const storage = this.state.storage;
      const cursor = storage.sql.exec(limitedQuery);
      const rows = cursor.toArray();

      return {
        success: true,
        rows,
        rowCount: rows.length,
        limit,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Query failed",
      };
    }
  }

  /**
   * Get specific metrics for dashboard widgets
   */
  async getMetrics(options: {
    startDate?: Date;
    endDate?: Date;
    endDateIsExact?: boolean;
    metricType: 'events' | 'countries' | 'devices' | 'referers' | 'pages';
    limit?: number;
  }) {
    try {
      const { startDate, endDate, endDateIsExact, metricType, limit = 10 } = options;

      // Build date filter conditions
      const conditions = [];
      if (startDate) {
        conditions.push(gte(siteEvents.createdAt, startDate));
      }
      if (endDate) {
        conditions.push(lte(siteEvents.createdAt, resolveEndDate(endDate, endDateIsExact)));
      }
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      let data;
      switch (metricType) {
        case 'events':
          data = await this.db
            .select({
              label: siteEvents.event,
              count: count()
            })
            .from(siteEvents)
            .where(whereClause)
            .groupBy(siteEvents.event)
            .orderBy(desc(count()))
            .limit(limit);
          break;
        case 'countries':
          data = await this.db
            .select({
              label: siteEvents.country,
              count: count()
            })
            .from(siteEvents)
            .where(whereClause)
            .groupBy(siteEvents.country)
            .orderBy(desc(count()))
            .limit(limit);
          break;
        case 'devices':
          data = await this.db
            .select({
              label: siteEvents.device_type,
              count: count()
            })
            .from(siteEvents)
            .where(whereClause)
            .groupBy(siteEvents.device_type)
            .orderBy(desc(count()))
            .limit(limit);
          break;
        case 'referers':
          data = await this.db
            .select({
              label: siteEvents.referer,
              count: count()
            })
            .from(siteEvents)
            .where(whereClause)
            .groupBy(siteEvents.referer)
            .orderBy(desc(count()))
            .limit(limit);
          break;
        case 'pages':
          data = await this.db
            .select({
              label: siteEvents.page_url,
              count: count()
            })
            .from(siteEvents)
            .where(whereClause)
            .groupBy(siteEvents.page_url)
            .orderBy(desc(count()))
            .limit(limit);
          break;
        default:
          throw new Error('Invalid metric type. Use: events, countries, devices, referers, or pages');
      }

      return {
        metricType,
        data: data.map(item => ({ label: item.label || 'Unknown', count: item.count })),
        siteId: this.site_id,
        dateRange: {
          start: startDate?.toISOString(),
          end: endDate?.toISOString()
        }
      };
    } catch (error) {
      if (this.env.ENVIRONMENT === "development") console.error(`SiteDurableObject getMetrics error for site ${this.site_id}:`, error);
      return {
        metricType: options.metricType,
        data: [],
        siteId: this.site_id,
        dateRange: {
          start: options.startDate?.toISOString(),
          end: options.endDate?.toISOString()
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Delete events (for cleanup/testing)
   */
  async deleteEvents(options: {
    olderThan?: Date;
    eventType?: string;
  }) {
    try {
      const { olderThan, eventType } = options;

      if (!olderThan && !eventType) {
        return {
          success: false,
          deleted: '0',
          siteId: this.site_id,
          error: 'Must specify either olderThan date or event type for deletion'
        };
      }

      const conditions = [];
      if (olderThan) {
        conditions.push(lte(siteEvents.createdAt, olderThan));
      }
      if (eventType) {
        conditions.push(eq(siteEvents.event, eventType));
      }

      await this.db
        .delete(siteEvents)
        .where(and(...conditions));

      return {
        success: true,
        deleted: 'unknown', // D1 doesn't return rowsAffected in durable objects
        siteId: this.site_id
      };
    } catch (error) {
      if (this.env.ENVIRONMENT === "development") console.error(`SiteDurableObject deleteEvents error for site ${this.site_id}:`, error);
      return {
        success: false,
        deleted: '0',
        siteId: this.site_id,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get an approximate count of current visitors.
   *
   * Uses distinct `rid` values over a rolling time window.
   */
  async getCurrentVisitors(options: { windowSeconds?: number } = {}) {
    try {
      const windowSeconds = Math.max(1, options.windowSeconds ?? 60 * 5);
      const startDate = new Date(Date.now() - windowSeconds * 1000);

      const conditions = [
        gte(siteEvents.createdAt, startDate),
        isNotNull(siteEvents.rid),
        ne(siteEvents.rid, ""),
      ];

      const result = await this.db
        .select({
          count: sql<number>`COUNT(DISTINCT ${siteEvents.rid})`,
        })
        .from(siteEvents)
        .where(and(...conditions));

      return {
        currentVisitors: result[0]?.count || 0,
        windowSeconds,
        siteId: this.site_id,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (this.env.ENVIRONMENT === "development") console.error(`SiteDurableObject getCurrentVisitors error for site ${this.site_id}:`, error);
      return {
        currentVisitors: 0,
        windowSeconds: options.windowSeconds ?? 60 * 5,
        siteId: this.site_id,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async countEventsSince(options: { startDate: Date; endDate?: Date }) {
    if (!this.site_id) {
      return {
        count: 0,
        siteId: this.site_id,
        error: "Site not initialized",
      };
    }

    const conditions = [gte(siteEvents.createdAt, options.startDate)];
    if (options.endDate) {
      conditions.push(lte(siteEvents.createdAt, options.endDate));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const result = await this.db
      .select({ count: count() })
      .from(siteEvents)
      .where(whereClause);

    return {
      count: result[0]?.count || 0,
      siteId: this.site_id,
    };
  }

  /**
   * Get schema information for the database tables.
   * Returns column definitions and index information using SQLite PRAGMA.
   */
  async getSchema() {
    try {
      const storage = this.state.storage;

      // Get table info using PRAGMA
      const tableInfoCursor = storage.sql.exec("PRAGMA table_info(site_events)");
      const columns = tableInfoCursor.toArray().map((col: Record<string, unknown>) => ({
        name: col.name as string,
        type: col.type as string,
        nullable: col.notnull === 0,
        primaryKey: col.pk === 1,
        defaultValue: col.dflt_value as string | null,
      }));

      // Get index info
      const indexListCursor = storage.sql.exec("PRAGMA index_list(site_events)");
      const indexList = indexListCursor.toArray();
      
      const indexes: { name: string; columns: string[]; unique: boolean }[] = [];
      for (const idx of indexList) {
        const indexName = idx.name as string;
        const indexInfoCursor = storage.sql.exec(`PRAGMA index_info("${indexName}")`);
        const indexColumns = indexInfoCursor.toArray().map((c: Record<string, unknown>) => c.name as string);
        indexes.push({
          name: indexName,
          columns: indexColumns,
          unique: idx.unique === 1,
        });
      }

      return {
        success: true,
        tables: [
          {
            name: "site_events",
            columns,
            indexes,
          },
        ],
        siteId: this.site_id,
      };
    } catch (error) {
      if (this.env.ENVIRONMENT === "development") console.error(`SiteDurableObject getSchema error:`, error);
      return {
        success: false,
        tables: [],
        siteId: this.site_id,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Health check endpoint
   */
  async healthCheck() {
    try {
      const result = await this.db
        .select({ count: count() })
        .from(siteEvents);

      const totalEvents = result[0]?.count || 0;

      return {
        status: 'healthy',
        siteId: this.site_id,
        totalEvents,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      if (this.env.ENVIRONMENT === "development") console.error(`SiteDurableObject healthCheck error for site ${this.site_id}:`, error);
      return {
        status: 'error',
        siteId: this.site_id,
        totalEvents: 0,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
