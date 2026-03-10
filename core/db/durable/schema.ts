import { integer, primaryKey, sqliteTable, text, index } from "drizzle-orm/sqlite-core";

import { analyticsMetricFamilies } from "./analyticsDailyRollups";
import { siteEvents as durableSiteEvents } from "@db/d1/schema";

export const siteEvents = durableSiteEvents;

export const dailySiteMetrics = sqliteTable("daily_site_metrics", {
  utcDay: text("utc_day").primaryKey(),
  totalEvents: integer("total_events").notNull().default(0),
  pageViews: integer("page_views").notNull().default(0),
  conversionEvents: integer("conversion_events").notNull().default(0),
  updatedAt: integer("updated_at").notNull(),
});

export const dailyMetricFacts = sqliteTable(
  "daily_metric_facts",
  {
    utcDay: text("utc_day").notNull(),
    metricFamily: text("metric_family", { enum: analyticsMetricFamilies }).notNull(),
    metricKey: text("metric_key").notNull(),
    metricValue: integer("metric_value").notNull().default(0),
    dimensionJson: text("dimension_json", { mode: "json" }).$type<Record<string, string | null> | null>(),
    firstSeenAt: integer("first_seen_at"),
    lastSeenAt: integer("last_seen_at"),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.utcDay, table.metricFamily, table.metricKey] }),
    index("daily_metric_facts_family_day_idx").on(table.metricFamily, table.utcDay),
    index("daily_metric_facts_family_day_value_idx").on(table.metricFamily, table.utcDay, table.metricValue),
  ],
);

export type SiteEvent = typeof siteEvents.$inferSelect;
export type SiteEventInsert = typeof siteEvents.$inferInsert;
export type SiteEventSelect = typeof siteEvents.$inferSelect;
export type DailySiteMetricsSelect = typeof dailySiteMetrics.$inferSelect;
export type DailySiteMetricsInsert = typeof dailySiteMetrics.$inferInsert;
export type DailyMetricFactsSelect = typeof dailyMetricFacts.$inferSelect;
export type DailyMetricFactsInsert = typeof dailyMetricFacts.$inferInsert;
