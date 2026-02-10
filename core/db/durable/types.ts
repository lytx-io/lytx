import type { DrizzleSqliteDODatabase } from "drizzle-orm/durable-sqlite";

import type * as schema from "@db/durable/schema";
export type Durable_DB = DrizzleSqliteDODatabase<typeof schema>;
export type GetEventsOptions = {
  startDate?: Date;
  endDate?: Date;
  eventType?: string;
  country?: string;
  deviceType?: string;
  referer?: string;
  limit?: number;
  offset?: number;
}

export interface SiteEventInput {
  bot_data?: object;
  browser?: string;
  city?: string;
  client_page_url?: string;
  country?: string;
  custom_data?: object;
  device_type?: string;
  event: string;
  operating_system?: string;
  page_url?: string;
  postal?: string;
  query_params?: object;
  referer?: string;
  region?: string;
  rid?: string;
  screen_height?: number;
  screen_width?: number;
  tag_id: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface DashboardOptions {
  site_id: number;
  site_uuid: string;
  team_id: number;
  date?: {
    start?: Date;
    end?: Date;
    /** When true, use end date as-is without adjusting to end of day (for sub-day ranges). */
    endIsExact?: boolean;
  };
  events?: {
    limit?: number;
    offset?: number;
  };
}
