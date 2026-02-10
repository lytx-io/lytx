import type { getDashboardData } from "@db/postgres/sites";
import type { DBAdapter, EventSelect } from "@db/d1/schema";
import type { d1_client } from "@db/d1/client";
import type { pg_client } from "@db/postgres/client";
import type { DashboardOptions } from "@db/durable/types";


export type D1Client = typeof d1_client;
export type PGClient = ReturnType<typeof pg_client>;

//TODO: move implementation over
type SingleStoreClient = any;

export type AdapterToClient = {
  "sqlite": D1Client;
  "postgres": PGClient;
  //WARNING: This is not a real client
  "singlestore": SingleStoreClient;
  "analytics_engine": SingleStoreClient;
};

export type UserRole = "viewer" | "editor" | "admin";


export type Pagination = {
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
}

/**
 * Client utilities for communicating with Site Durable Objects
 * 
 * These functions handle the communication between the main worker
 * and the site-specific durable objects using RPC calls instead of fetch.
 */
export interface DashboardDataResult {
  //TODO: make this typed
  events: Array<Partial<EventSelect>>;
  error: boolean;
  pagination: Pagination;
  site_id: number;
  site_uuid: string;
}

export interface AdapterResult<T extends DBAdapter> {
  adapter: T;
  client: AdapterToClient[T] | null;
  noSiteRecordsExist: boolean;
  query: DashboardDataResult | null;

}
export type DasboardDataResult = Awaited<ReturnType<typeof getDashboardData>["query"]>;
export type { DBAdapter, DashboardOptions };
