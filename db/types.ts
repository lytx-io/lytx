import type { getDashboardData } from "@db/postgres/sites";
export type DashboardOptions = {
  site_id: number | string,
  team_id: number,
  connectionString?: string,
  date?: {
    start?: Date,
    end?: Date
  }
}

export type DasboardDataResult = Awaited<ReturnType<typeof getDashboardData>["query"]>;

