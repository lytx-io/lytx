/**
 * Optimized Dashboard Query Functions for Durable Objects
 * 
 * These functions provide efficient querying capabilities specifically designed
 * for site-specific durable objects, taking advantage of the optimized indexes
 * and storage structure.
 */

import { eq, and, gte, lte, desc, count, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { siteEvents } from "@/session/siteSchema";

type DatabaseType = ReturnType<typeof drizzle>;

/**
 * Date range interface for queries
 */
export interface DateRange {
  start?: Date;
  end?: Date;
}

/**
 * Dashboard filter options
 */
export interface DashboardFilters {
  dateRange?: DateRange;
  eventTypes?: string[];
  countries?: string[];
  deviceTypes?: string[];
  referers?: string[];
  tagIds?: string[];
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

/**
 * Time series data point
 */
export interface TimeSeriesPoint {
  date: string;
  count: number;
  event?: string;
}

/**
 * Aggregated metric result
 */
export interface MetricResult {
  label: string;
  value: number;
  percentage?: number;
}

/**
 * Build common WHERE conditions from filters
 */
function buildWhereConditions(filters: DashboardFilters) {
  const conditions = [];

  // Date range filtering
  if (filters.dateRange?.start) {
    conditions.push(gte(siteEvents.createdAt, filters.dateRange.start));
  }
  if (filters.dateRange?.end) {
    conditions.push(lte(siteEvents.createdAt, filters.dateRange.end));
  }

  // Event type filtering
  if (filters.eventTypes && filters.eventTypes.length > 0) {
    if (filters.eventTypes.length === 1) {
      conditions.push(eq(siteEvents.event, filters.eventTypes[0]));
    } else {
      conditions.push(sql`${siteEvents.event} IN ${filters.eventTypes}`);
    }
  }

  // Country filtering
  if (filters.countries && filters.countries.length > 0) {
    if (filters.countries.length === 1) {
      conditions.push(eq(siteEvents.country, filters.countries[0]));
    } else {
      conditions.push(sql`${siteEvents.country} IN ${filters.countries}`);
    }
  }

  // Device type filtering
  if (filters.deviceTypes && filters.deviceTypes.length > 0) {
    if (filters.deviceTypes.length === 1) {
      conditions.push(eq(siteEvents.device_type, filters.deviceTypes[0]));
    } else {
      conditions.push(sql`${siteEvents.device_type} IN ${filters.deviceTypes}`);
    }
  }

  // Tag ID filtering
  if (filters.tagIds && filters.tagIds.length > 0) {
    if (filters.tagIds.length === 1) {
      conditions.push(eq(siteEvents.tag_id, filters.tagIds[0]));
    } else {
      conditions.push(sql`${siteEvents.tag_id} IN ${filters.tagIds}`);
    }
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

/**
 * Get total event count with filters
 */
export async function getTotalEventCount(
  db: DatabaseType,
  filters: DashboardFilters = {}
): Promise<number> {
  const whereClause = buildWhereConditions(filters);
  
  const result = await db
    .select({ count: count() })
    .from(siteEvents)
    .where(whereClause);
    
  return result[0]?.count || 0;
}

/**
 * Get events by type with counts (optimized for pie charts)
 */
export async function getEventTypeMetrics(
  db: DatabaseType,
  filters: DashboardFilters = {},
  limit: number = 10
): Promise<MetricResult[]> {
  const whereClause = buildWhereConditions(filters);
  
  const results = await db
    .select({ 
      event: siteEvents.event, 
      count: count() 
    })
    .from(siteEvents)
    .where(whereClause)
    .groupBy(siteEvents.event)
    .orderBy(desc(count()))
    .limit(limit);

  // Calculate total for percentages
  const total = results.reduce((sum, item) => sum + item.count, 0);
  
  return results.map(item => ({
    label: item.event || 'Unknown',
    value: item.count,
    percentage: total > 0 ? Math.round((item.count / total) * 100) : 0
  }));
}

/**
 * Get country distribution metrics (optimized for geo charts)
 */
export async function getCountryMetrics(
  db: DatabaseType,
  filters: DashboardFilters = {},
  limit: number = 20
): Promise<MetricResult[]> {
  const whereClause = buildWhereConditions(filters);
  
  const results = await db
    .select({ 
      country: siteEvents.country, 
      count: count() 
    })
    .from(siteEvents)
    .where(whereClause)
    .groupBy(siteEvents.country)
    .orderBy(desc(count()))
    .limit(limit);

  const total = results.reduce((sum, item) => sum + item.count, 0);
  
  return results.map(item => ({
    label: item.country || 'Unknown',
    value: item.count,
    percentage: total > 0 ? Math.round((item.count / total) * 100) : 0
  }));
}

/**
 * Get device type distribution (optimized for bar charts)
 */
export async function getDeviceTypeMetrics(
  db: DatabaseType,
  filters: DashboardFilters = {}
): Promise<MetricResult[]> {
  const whereClause = buildWhereConditions(filters);
  
  const results = await db
    .select({ 
      device_type: siteEvents.device_type, 
      count: count() 
    })
    .from(siteEvents)
    .where(whereClause)
    .groupBy(siteEvents.device_type)
    .orderBy(desc(count()));

  const total = results.reduce((sum, item) => sum + item.count, 0);
  
  return results.map(item => ({
    label: item.device_type || 'Unknown',
    value: item.count,
    percentage: total > 0 ? Math.round((item.count / total) * 100) : 0
  }));
}

/**
 * Get top referers (optimized for traffic source analysis)
 */
export async function getTopReferers(
  db: DatabaseType,
  filters: DashboardFilters = {},
  limit: number = 10
): Promise<MetricResult[]> {
  const whereClause = buildWhereConditions(filters);
  
  const results = await db
    .select({ 
      referer: siteEvents.referer, 
      count: count() 
    })
    .from(siteEvents)
    .where(whereClause)
    .groupBy(siteEvents.referer)
    .orderBy(desc(count()))
    .limit(limit);

  const total = results.reduce((sum, item) => sum + item.count, 0);
  
  return results.map(item => ({
    label: cleanReferer(item.referer || 'Direct'),
    value: item.count,
    percentage: total > 0 ? Math.round((item.count / total) * 100) : 0
  }));
}

/**
 * Get top pages by URL (optimized for content analysis)
 */
export async function getTopPages(
  db: DatabaseType,
  filters: DashboardFilters = {},
  limit: number = 10
): Promise<MetricResult[]> {
  const whereClause = buildWhereConditions(filters);
  
  const results = await db
    .select({ 
      page_url: siteEvents.page_url, 
      count: count() 
    })
    .from(siteEvents)
    .where(whereClause)
    .groupBy(siteEvents.page_url)
    .orderBy(desc(count()))
    .limit(limit);

  const total = results.reduce((sum, item) => sum + item.count, 0);
  
  return results.map(item => ({
    label: cleanUrl(item.page_url || 'Unknown'),
    value: item.count,
    percentage: total > 0 ? Math.round((item.count / total) * 100) : 0
  }));
}

/**
 * Get time series data for line charts (optimized with date truncation)
 */
export async function getTimeSeriesData(
  db: DatabaseType,
  filters: DashboardFilters = {},
  granularity: 'hour' | 'day' | 'week' | 'month' = 'day'
): Promise<TimeSeriesPoint[]> {
  const whereClause = buildWhereConditions(filters);
  
  // Use SQLite date functions for efficient grouping
  let dateFormat: string;
  switch (granularity) {
    case 'hour':
      dateFormat = '%Y-%m-%d %H:00:00';
      break;
    case 'day':
      dateFormat = '%Y-%m-%d';
      break;
    case 'week':
      dateFormat = '%Y-W%W';
      break;
    case 'month':
      dateFormat = '%Y-%m';
      break;
  }
  
  const timeBucketExpr = sql<string>`strftime(${dateFormat}, ${siteEvents.createdAt})`;

  const results = await db
    .select({
      date: timeBucketExpr,
      count: count()
    })
    .from(siteEvents)
    .where(whereClause)
    .groupBy(timeBucketExpr)
    .orderBy(timeBucketExpr);

  return results.map(item => ({
    date: item.date,
    count: item.count
  }));
}

/**
 * Get time series data by event type (for multi-line charts)
 */
export async function getTimeSeriesByEvent(
  db: DatabaseType,
  filters: DashboardFilters = {},
  granularity: 'hour' | 'day' | 'week' | 'month' = 'day',
  topEventTypes: number = 5
): Promise<{ [eventType: string]: TimeSeriesPoint[] }> {
  const whereClause = buildWhereConditions(filters);
  
  // First, get top event types
  const topEvents = await db
    .select({ 
      event: siteEvents.event, 
      count: count() 
    })
    .from(siteEvents)
    .where(whereClause)
    .groupBy(siteEvents.event)
    .orderBy(desc(count()))
    .limit(topEventTypes);

  const eventTypes = topEvents.map(e => e.event);
  
  // Get time series for each event type
  let dateFormat: string;
  switch (granularity) {
    case 'hour':
      dateFormat = '%Y-%m-%d %H:00:00';
      break;
    case 'day':
      dateFormat = '%Y-%m-%d';
      break;
    case 'week':
      dateFormat = '%Y-W%W';
      break;
    case 'month':
      dateFormat = '%Y-%m';
      break;
  }
  
  const timeBucketExpr = sql<string>`strftime(${dateFormat}, ${siteEvents.createdAt})`;

  const results = await db
    .select({
      date: timeBucketExpr,
      event: siteEvents.event,
      count: count()
    })
    .from(siteEvents)
    .where(and(
      whereClause,
      sql`${siteEvents.event} IN ${eventTypes}`
    ))
    .groupBy(
      timeBucketExpr,
      siteEvents.event
    )
    .orderBy(timeBucketExpr);

  // Group by event type
  const grouped: { [eventType: string]: TimeSeriesPoint[] } = {};
  
  for (const result of results) {
    if (!grouped[result.event]) {
      grouped[result.event] = [];
    }
    grouped[result.event].push({
      date: result.date,
      count: result.count,
      event: result.event
    });
  }
  
  return grouped;
}

/**
 * Get comprehensive dashboard summary (single optimized query)
 */
export async function getDashboardSummary(
  db: DatabaseType,
  filters: DashboardFilters = {}
): Promise<{
  totalEvents: number;
  uniqueVisitors: number;
  topEventTypes: MetricResult[];
  topCountries: MetricResult[];
  topDevices: MetricResult[];
  topReferers: MetricResult[];
}> {
  const whereClause = buildWhereConditions(filters);
  
  // Execute multiple queries in parallel for better performance
  const [
    totalEventsResult,
    uniqueVisitorsResult,
    eventTypesResult,
    countriesResult,
    devicesResult,
    referersResult
  ] = await Promise.all([
    // Total events
    db.select({ count: count() }).from(siteEvents).where(whereClause),
    
    // Unique visitors (approximate using distinct RIDs)
    db.select({ count: sql<number>`COUNT(DISTINCT ${siteEvents.rid})` }).from(siteEvents).where(whereClause),
    
    // Top event types
    db.select({ 
      event: siteEvents.event, 
      count: count() 
    })
    .from(siteEvents)
    .where(whereClause)
    .groupBy(siteEvents.event)
    .orderBy(desc(count()))
    .limit(5),
    
    // Top countries
    db.select({ 
      country: siteEvents.country, 
      count: count() 
    })
    .from(siteEvents)
    .where(whereClause)
    .groupBy(siteEvents.country)
    .orderBy(desc(count()))
    .limit(5),
    
    // Top devices
    db.select({ 
      device_type: siteEvents.device_type, 
      count: count() 
    })
    .from(siteEvents)
    .where(whereClause)
    .groupBy(siteEvents.device_type)
    .orderBy(desc(count()))
    .limit(5),
    
    // Top referers
    db.select({ 
      referer: siteEvents.referer, 
      count: count() 
    })
    .from(siteEvents)
    .where(whereClause)
    .groupBy(siteEvents.referer)
    .orderBy(desc(count()))
    .limit(5)
  ]);

  const totalEvents = totalEventsResult[0]?.count || 0;
  
  return {
    totalEvents,
    uniqueVisitors: uniqueVisitorsResult[0]?.count || 0,
    topEventTypes: eventTypesResult.map(item => ({
      label: item.event || 'Unknown',
      value: item.count,
      percentage: totalEvents > 0 ? Math.round((item.count / totalEvents) * 100) : 0
    })),
    topCountries: countriesResult.map(item => ({
      label: item.country || 'Unknown',
      value: item.count,
      percentage: totalEvents > 0 ? Math.round((item.count / totalEvents) * 100) : 0
    })),
    topDevices: devicesResult.map(item => ({
      label: item.device_type || 'Unknown',
      value: item.count,
      percentage: totalEvents > 0 ? Math.round((item.count / totalEvents) * 100) : 0
    })),
    topReferers: referersResult.map(item => ({
      label: cleanReferer(item.referer || 'Direct'),
      value: item.count,
      percentage: totalEvents > 0 ? Math.round((item.count / totalEvents) * 100) : 0
    }))
  };
}

/**
 * Helper function to clean referer URLs
 */
function cleanReferer(referer: string): string {
  if (!referer || referer === 'null' || referer === '') {
    return 'Direct';
  }
  
  try {
    const url = new URL(referer);
    return url.hostname;
  } catch {
    return referer.length > 50 ? referer.substring(0, 47) + '...' : referer;
  }
}

/**
 * Helper function to clean page URLs
 */
function cleanUrl(url: string): string {
  if (!url || url === 'null' || url === '') {
    return 'Unknown';
  }
  
  try {
    const urlObj = new URL(url);
    return urlObj.pathname + (urlObj.search ? urlObj.search : '');
  } catch {
    return url.length > 50 ? url.substring(0, 47) + '...' : url;
  }
}
