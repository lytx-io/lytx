import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

/**
 * Site-specific schema for Durable Objects
 * 
 * This schema contains only site-specific data (siteEvents) without auth tables.
 * Each durable object represents a single site, so team_id and site_id are not needed
 * as they are implicit in the durable object context.
 */

export const siteEvents = sqliteTable(
  "site_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    // Note: team_id and site_id removed - implicit in durable object context
    bot_data: text("bot_data", { mode: "json" }),
    browser: text("browser"),
    city: text("city"),
    client_page_url: text("client_page_url"),
    country: text("country"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .notNull()
      .$onUpdateFn(() => new Date()),
    custom_data: text("custom_data", { mode: "json" }),
    device_type: text("device_type"),
    event: text("event").notNull(),
    operating_system: text("operating_system"),
    page_url: text("page_url"),
    postal: text("postal"),
    query_params: text("query_params", { mode: "json" }),
    referer: text("referer"),
    region: text("region"),
    rid: text("rid"),
    screen_height: integer("screen_height"),
    screen_width: integer("screen_width"),
    tag_id: text("tag_id").notNull(),
  },
  (table) => [
    // Optimized indexes for site-specific queries (no team/site composite indexes needed)
    index("site_events_created_at_idx").on(table.createdAt),
    index("site_events_tag_id_idx").on(table.tag_id),

    // Analytics filtering indexes
    index("site_events_country_idx").on(table.country),
    index("site_events_device_type_idx").on(table.device_type),
    index("site_events_event_idx").on(table.event),
    index("site_events_referer_idx").on(table.referer),

    // Time-based analytics (common dashboard queries)
    index("site_events_event_created_idx").on(table.event, table.createdAt),
    index("site_events_country_created_idx").on(table.country, table.createdAt),
    index("site_events_device_created_idx").on(table.device_type, table.createdAt),
  ],
);

// Type definitions for site events
export type SiteEvent = typeof siteEvents.$inferSelect;
export type SiteEventInsert = typeof siteEvents.$inferInsert;

// Input type for API operations (matches the structure expected from external sources)
export interface SiteEventInput {
  bot_data?: Record<string, string>;
  browser?: string;
  city?: string;
  client_page_url?: string;
  country?: string;
  custom_data?: Record<string, string>;
  device_type?: string;
  event: string;
  operating_system?: string;
  page_url?: string;
  postal?: string;
  query_params?: Record<string, string>;
  referer?: string;
  region?: string;
  rid?: string;
  screen_height?: number;
  screen_width?: number;
  tag_id: string;
  createdAt?: Date;
  updatedAt?: Date;
}
