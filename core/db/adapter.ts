import { getDashboardDataFromDurableObject, getSiteInfo } from "@db/durable/durableObjectClient";
import { processDirectSiteEvents, batchProcessSiteEvents } from "@/api/queueWorker";
import { getSiteForTag } from "@db/d1/sites";

import { getDashboardData as getPostgresDashboardData } from "@db/postgres/sites";
import type { DashboardOptions, DBAdapter } from "@db/types";
import type { SiteEventInput } from "@/session/siteSchema";
import { IS_DEV } from "rwsdk/constants";

/**
 * Updated Site Adapter - All dashboard reads now go to durable objects for performance
 */
const SiteAdapter = {
  //NOTE: The sites are from durable objects, but all account admin is d1
  "sqlite": getDashboardDataFromDurableObject,
  "postgres": getDashboardDataFromDurableObject, // Fast reads from durable object
  "singlestore": getDashboardDataFromDurableObject,
  "analytics_engine": getDashboardDataFromDurableObject
} as const;

/**
 * Get dashboard data from site-specific durable objects
 * All adapters now use durable objects for fast dashboard access
 */
export async function getDashboardData<T extends DBAdapter>(
  adapter: T,
  options: DashboardOptions,
) {
  if (IS_DEV) {
    console.log(`Adapter set to : ${adapter} with options:`);
    console.dir(options);
  }
  return SiteAdapter[adapter](options);
}

/**
 * Insert site events with intelligent routing based on site adapter
 * - sqlite sites: Direct write to durable object
 * - postgres/singlestore sites: Queue for dual-write (original DB + durable object)
 */
export async function insertSiteEvents(
  site_id: number,
  site_uuid: string,
  events: SiteEventInput[],
  db_adapter: DBAdapter
): Promise<{ success: boolean; inserted?: number; error?: string }> {
  try {
    // Get site information to determine routing strategy
    if (db_adapter === 'sqlite') {
      // Direct write to durable object for sqlite sites
      return await processDirectSiteEvents(site_id, site_uuid, events);

    } else if (db_adapter === 'postgres' || db_adapter === 'singlestore') {
      // Queue for dual-write (postgres/singlestore + durable object)
      const eventsBySite = new Map();
      eventsBySite.set(site_id, {
        siteUuid: site_uuid,
        teamId: 1, // TODO: Get actual team_id from site info
        adapter: db_adapter,
        events
      });

      await batchProcessSiteEvents(eventsBySite);

      return {
        success: true,
        inserted: events.length
      };

    } else {
      return {
        success: false,
        error: `Unsupported adapter: ${db_adapter}`
      };
    }

  } catch (error) {
    console.error(`Error inserting site events for site ${site_uuid}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Batch insert events for multiple sites
 */
export async function batchInsertSiteEvents(
  eventsBySite: Map<number, SiteEventInput[]>,
  env: Env
): Promise<Map<number, { success: boolean; inserted?: number; error?: string }>> {
  const results = new Map();

  // Group sites by adapter type for efficient processing
  const sqliteSites = new Map<number, SiteEventInput[]>();
  const queueSites = new Map<number, { teamId: number; adapter: string; events: SiteEventInput[] }>();

  // Categorize sites by adapter
  for (const [siteId, events] of eventsBySite) {
    const siteInfo = await getSiteInfo(siteId, env);

    if (!siteInfo) {
      results.set(siteId, { success: false, error: `Site ${siteId} not found` });
      continue;
    }

    if (siteInfo.site_db_adapter === 'sqlite') {
      sqliteSites.set(siteId, events);
    } else {
      queueSites.set(siteId, {
        teamId: 1, // TODO: Get actual team_id
        adapter: siteInfo.site_db_adapter,
        events
      });
    }
  }

  // Process sqlite sites directly (parallel)
  const sqlitePromises = Array.from(sqliteSites.entries()).map(async ([siteId, events]) => {
    const result = await processDirectSiteEvents(siteId, events, env);
    return [siteId, result] as const;
  });

  const sqliteResults = await Promise.allSettled(sqlitePromises);
  sqliteResults.forEach((result, index) => {
    const siteId = Array.from(sqliteSites.keys())[index];
    if (result.status === 'fulfilled') {
      results.set(result.value[0], result.value[1]);
    } else {
      results.set(siteId, { success: false, error: `Batch processing failed: ${result.reason}` });
    }
  });

  // Process queue sites in batch
  if (queueSites.size > 0) {
    try {
      await batchProcessSiteEvents(queueSites, env);
      // Mark all queue sites as successful
      for (const [siteId, { events }] of queueSites) {
        results.set(siteId, { success: true, inserted: events.length });
      }
    } catch (error) {
      // Mark all queue sites as failed
      for (const siteId of queueSites.keys()) {
        results.set(siteId, {
          success: false,
          error: error instanceof Error ? error.message : 'Queue processing failed'
        });
      }
    }
  }

  return results;
}

/**
 * Get site adapter type for routing decisions
 */
export async function getSiteAdapter(siteId: number, env: Env): Promise<DBAdapter | null> {
  const siteInfo = await getSiteInfo(siteId, env);
  return siteInfo ? (siteInfo.site_db_adapter as DBAdapter) : null;
}
