// src/api/events_api.ts

import { route } from 'rwsdk/router';
import { env } from 'cloudflare:workers';
import { insertSiteEvents } from '@db/adapter';
import { getDashboardDataFromDurableObject } from '@db/durable/durableObjectClient';
import type { SiteEventInput } from '@/session/siteSchema';
import type { DBAdapter } from '@db/types';
import { d1_client } from '@db/d1/client';
import { sites } from '@db/d1/schema';
import { eq } from 'drizzle-orm';
import { IS_DEV } from 'rwsdk/constants';

const SEED_DATA_SECRET = (env as { SEED_DATA_SECRET?: string }).SEED_DATA_SECRET;

/**
 * Get events from site durable object
 */
export async function getEventsFromSite(
  siteId: number,
  siteUuid: string,
  tagId?: string,
) {
  try {
    const dashboardData = await getDashboardDataFromDurableObject({
      site_id: siteId,
      site_uuid: siteUuid,
      team_id: 1, // TODO: Get actual team_id
      date: {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        end: new Date(),
      },
    });

    if (dashboardData.query) {
      // Filter by tagId if provided
      let events = dashboardData.query.events || [];
      if (tagId) {
        events = events.filter((event: any) => event.tag_id === tagId);
      }
      return events;
    }

    return [];
  } catch (error) {
    console.error(`Error fetching events for site ${siteId}:`, error);
    throw new Error(
      `Failed to fetch events: ${error instanceof Error ? error.message : String(error)}`, { cause: error },
    );
  }
}

/**
 * Save events to site durable object via insertSiteEvents
 */
export async function saveEventsToSite(
  siteId: number,
  eventsData: SiteEventInput[],
  siteUuid: string,
  siteAdapter: DBAdapter,
): Promise<{ success: boolean; inserted?: number; error?: string }> {
  if (!Array.isArray(eventsData)) {
    return { success: false, error: 'Events data must be an array' };
  }

  if (eventsData.length === 0) {
    return { success: true, inserted: 0 };
  }

  try {
    const result = await insertSiteEvents(siteId, siteUuid, eventsData, siteAdapter);
    return result;
  } catch (error) {
    console.error(`Error saving events for site ${siteId}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}


/**
 * GET/POST /api/events/:siteId/:tagId
 * 
 * Updated events API endpoint that uses durable objects
 * - GET: Fetch events from site durable object, optionally filtered by tagId
 * - POST: Insert events into site durable object via insertSiteEvents
 */
export const eventsApi = route(
  "/api/events/*",
  async ({ params, request }) => {
    if (!["GET", "POST"].includes(request.method)) {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const seedSecretHeader = request.headers.get("x-seed-secret");

    if (!IS_DEV) {
      if (!seedSecretHeader) {
        return new Response("Unauthorized", { status: 401 });
      }
      return new Response("Seed endpoint disabled outside dev.", { status: 403 });
    }

    if (!SEED_DATA_SECRET) {
      return new Response("SEED_DATA_SECRET is not configured.", { status: 500 });
    }

    if (seedSecretHeader !== SEED_DATA_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    const pathPart = params.$0 ?? "";
    const [siteIdStr, tagId] = pathPart.split("/");

    if (!siteIdStr) {
      return new Response("Site ID is required", { status: 400 });
    }

    const siteId = parseInt(siteIdStr, 10);
    if (isNaN(siteId)) {
      return new Response("Invalid site ID format", { status: 400 });
    }

    const [siteDetails] = await d1_client
      .select({ uuid: sites.uuid, site_db_adapter: sites.site_db_adapter })
      .from(sites)
      .where(eq(sites.site_id, siteId))
      .limit(1);

    if (!siteDetails) {
      return new Response("Site not found", { status: 404 });
    }

    const siteAdapter = (siteDetails.site_db_adapter ?? "sqlite") as DBAdapter;

    // GET: Fetch events from durable object
    if (request.method === "GET") {
      try {
        const events = await getEventsFromSite(siteId, siteDetails.uuid, tagId);
        return new Response(JSON.stringify(events), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error(`Error in GET /api/events/${siteId}/${tagId || ''} route:`, error);
        return new Response(error instanceof Error ? error.message : "Failed to fetch events", { status: 500 });
      }
    }

    // POST: Insert events into durable object
    if (request.method === "POST") {
      try {
        const eventsData = await request.json() as SiteEventInput[];
        if (!Array.isArray(eventsData)) {
          return new Response("Invalid events data format: expected an array.", { status: 400 });
        }

        // Validate required fields
        for (const event of eventsData) {
          if (!event.event || !event.tag_id) {
            return new Response("Each event must have 'event' and 'tag_id' fields", { status: 400 });
          }
        }

        const normalizedEvents = eventsData.map((event) => ({
          ...event,
          createdAt: event.createdAt ? new Date(event.createdAt) : undefined,
          updatedAt: event.updatedAt ? new Date(event.updatedAt) : undefined,
        }));

        const result = await saveEventsToSite(siteId, normalizedEvents, siteDetails.uuid, siteAdapter);

        if (result.success) {
          return new Response(JSON.stringify({
            message: "Events saved successfully",
            inserted: result.inserted || 0
          }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({
          error: result.error || "Failed to save events"
        }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      } catch (error) {
        console.error(`Error in POST /api/events/${siteId} route:`, error);
        const message = error instanceof Error ? error.message : "Failed to save events";

        if (message.includes("Unexpected token") || message.includes("JSON at position")) {
          return new Response("Invalid JSON format in request body.", { status: 400 });
        }

        return new Response(JSON.stringify({ error: message }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    return new Response("Method Not Allowed", { status: 405 });
  }
);


