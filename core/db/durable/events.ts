import type { Durable_DB, GetEventsOptions } from "@db/durable/types";
import { eq, and, gte, lte, desc, count } from "drizzle-orm";
import { siteEvents, type SiteEventInsert, type SiteEventSelect } from "@db/durable/schema";

/** Adjusts end date to include the entire day (23:59:59.999 UTC) */
function getEndOfDay(date: Date): Date {
  const endOfDay = new Date(date);
  endOfDay.setUTCHours(23, 59, 59, 999);
  return endOfDay;
}

export async function getEvents(db: Durable_DB, options: GetEventsOptions = {}) {
  const { startDate, endDate, eventType, country, deviceType, referer, limit = 100, offset = 0 } = options;


  // // Build query conditions
  const conditions = [];

  if (startDate) {
    conditions.push(gte(siteEvents.createdAt, startDate));
  }
  if (endDate) {
    conditions.push(lte(siteEvents.createdAt, getEndOfDay(endDate)));
  }
  if (eventType) {
    conditions.push(eq(siteEvents.event, eventType));
  }
  if (country) {
    conditions.push(eq(siteEvents.country, country));
  }
  if (deviceType) {
    conditions.push(eq(siteEvents.device_type, deviceType));
  }
  if (referer) {
    conditions.push(eq(siteEvents.referer, referer));
  }

  // Execute query
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const events = await db
    .select({
      id: siteEvents.id,
      event: siteEvents.event,
      createdAt: siteEvents.createdAt,
      updatedAt: siteEvents.updatedAt,
      tag_id: siteEvents.tag_id,
      bot_data: siteEvents.bot_data,
      browser: siteEvents.browser,
      city: siteEvents.city,
      client_page_url: siteEvents.client_page_url,
      country: siteEvents.country,
      custom_data: siteEvents.custom_data,
      device_type: siteEvents.device_type,
      operating_system: siteEvents.operating_system,
      page_url: siteEvents.page_url,
      postal: siteEvents.postal,
      query_params: siteEvents.query_params,
      referer: siteEvents.referer,
      region: siteEvents.region,
      rid: siteEvents.rid,
      site_id: siteEvents.site_id,
      screen_height: siteEvents.screen_height,
      screen_width: siteEvents.screen_width,


    })
    .from(siteEvents)
    .where(whereClause)
    .orderBy(desc(siteEvents.createdAt))
    .limit(limit)
    .offset(offset);

  const countResult = await db
    .select({ count: count() })
    .from(siteEvents)
    .where(whereClause)
  // return { error: false, events: events }

  const totalCount = countResult[0]?.count || 0;
  const totalAllTime = conditions.length > 0
    ? (await db.select({ count: count() }).from(siteEvents))[0]?.count || 0
    : totalCount;
  const pagination = {
    offset,
    total: totalCount,
    hasMore: offset + limit < totalCount,
    limit,
  }
  if (!events) return { error: true, events: null, pagination }
  // Get total count for pagination
  return {
    error: false,
    events,
    pagination,
    totalAllTime,
  };
}

export type GetEventResult = Awaited<ReturnType<typeof getEvents>>;
export type events_t = GetEventResult["events"];
