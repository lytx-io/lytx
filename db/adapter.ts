import { getDashboardData as getDashboardDataPostgres } from "@db/postgres/sites";
import { getDashboardData as getDashboardDataD1 } from "@db/d1/sites";
import type { DashboardOptions, AdapterToClient, DBAdapter } from "@db/types";

const SiteAdapter = {
  "sqlite": getDashboardDataD1,
  "postgres": getDashboardDataPostgres,
  //WARNING: This is not a real client yet
  "singlestore": (options: DashboardOptions) => { return { query: null, client: null, noSiteRecordsExist: false } }
} as const;

export async function getDashboardData<T extends DBAdapter>(adapter: T, options: DashboardOptions) {
  return SiteAdapter[adapter](options)
}
