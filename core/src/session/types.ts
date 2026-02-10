/**
 * Shared types for Site Durable Objects
 */

// Input type for API operations (matches the structure expected from external sources)
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
  site_id: number | string;
  team_id: number;
  date?: {
    start?: Date;
    end?: Date;
  };
}