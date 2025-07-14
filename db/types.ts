import type { getDashboardData } from "@db/postgres/sites";
import type { DBAdapter } from "@db/d1/schema";
import type { d1_client } from "@db/d1/client";
import type { pg_client } from "@db/postgres/client";

export type D1Client = typeof d1_client;
export type PGClient = ReturnType<typeof pg_client>;

//TODO: move implementation over
type SingleStoreClient = any;

export type AdapterToClient = {
  "sqlite": D1Client;
  "postgres": PGClient;
  //WARNING: This is not a real client
  "singlestore": SingleStoreClient;
};


export type DashboardOptions = {
  site_id: number | string,
  team_id: number,
  date?: {
    start?: Date,
    end?: Date
  }
}

export type DasboardDataResult = Awaited<ReturnType<typeof getDashboardData>["query"]>;
export type { DBAdapter };
