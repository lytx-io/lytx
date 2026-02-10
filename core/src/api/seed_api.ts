// src/api/seed_api.ts
// Seed API endpoint for local development - handles site lookup, creation, and event seeding

import { route } from 'rwsdk/router';
import { env } from 'cloudflare:workers';
import { d1_client } from '@db/d1/client';
import { sites, team } from '@db/d1/schema';
import { eq, and } from 'drizzle-orm';
import { IS_DEV } from 'rwsdk/constants';
import { createId } from '@paralleldrive/cuid2';
import { insertSiteEvents } from '@db/adapter';
import type { SiteEventInput } from '@/session/siteSchema';
import type { DBAdapter } from '@db/types';

const SEED_DATA_SECRET = (env as { SEED_DATA_SECRET?: string }).SEED_DATA_SECRET;
const ENVIRONMENT = (env as { ENVIRONMENT?: string }).ENVIRONMENT;

function validateSeedSecret(request: Request): Response | null {
  const seedSecretHeader = request.headers.get("x-seed-secret");

  // Multiple layers of protection to ensure this never runs in production
  // 1. Check IS_DEV from rwsdk (based on build mode)
  if (!IS_DEV) {
    return new Response("Seed endpoint disabled outside dev.", { status: 403 });
  }

  // 2. Explicitly check ENVIRONMENT env var
  if (ENVIRONMENT === "production" || ENVIRONMENT === "staging") {
    return new Response("Seed endpoint disabled in production/staging.", { status: 403 });
  }

  // 3. Require SEED_DATA_SECRET to be configured
  if (!SEED_DATA_SECRET) {
    return new Response("SEED_DATA_SECRET is not configured.", { status: 500 });
  }

  // 4. Validate the secret matches
  if (seedSecretHeader !== SEED_DATA_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  return null;
}

/**
 * GET /api/seed/site/:siteId?teamId=X
 * Look up a site by ID and team
 */
async function getSite(siteId: number, teamId: number) {
  const [siteDetails] = await d1_client
    .select({
      site_id: sites.site_id,
      uuid: sites.uuid,
      tag_id: sites.tag_id,
      name: sites.name,
      domain: sites.domain,
      site_db_adapter: sites.site_db_adapter,
    })
    .from(sites)
    .where(and(eq(sites.site_id, siteId), eq(sites.team_id, teamId)))
    .limit(1);

  return siteDetails;
}

/**
 * POST /api/seed/site
 * Create a new site
 */
async function createSite(data: {
  teamId: number;
  name: string;
  domain: string;
}) {
  const tagId = createId();
  const uuid = createId();
  const ridSalt = createId();
  const ridSaltExpire = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await d1_client.insert(sites).values({
    uuid,
    tag_id: tagId,
    track_web_events: true,
    event_load_strategy: 'sdk',
    team_id: data.teamId,
    name: data.name,
    domain: data.domain,
    gdpr: false,
    rid_salt: ridSalt,
    rid_salt_expire: ridSaltExpire,
  });

  // Fetch the created site to get the auto-generated site_id
  const [createdSite] = await d1_client
    .select({
      site_id: sites.site_id,
      uuid: sites.uuid,
      tag_id: sites.tag_id,
      name: sites.name,
      domain: sites.domain,
      site_db_adapter: sites.site_db_adapter,
    })
    .from(sites)
    .where(eq(sites.tag_id, tagId))
    .limit(1);

  return createdSite;
}

/**
 * POST /api/seed/events/:siteId
 * Insert events into a site's durable object
 */
async function seedEvents(
  siteId: number,
  siteUuid: string,
  siteAdapter: DBAdapter,
  events: SiteEventInput[],
) {
  const normalizedEvents = events.map((event) => ({
    ...event,
    createdAt: event.createdAt ? new Date(event.createdAt) : undefined,
    updatedAt: event.updatedAt ? new Date(event.updatedAt) : undefined,
  }));

  return await insertSiteEvents(siteId, siteUuid, normalizedEvents, siteAdapter);
}

/**
 * GET /api/seed/team/:teamId
 * Check if a team exists
 */
async function getTeam(teamId: number) {
  const [teamDetails] = await d1_client
    .select({
      id: team.id,
      name: team.name,
      db_adapter: team.db_adapter,
    })
    .from(team)
    .where(eq(team.id, teamId))
    .limit(1);

  return teamDetails;
}

/**
 * Seed API endpoint
 * 
 * Routes:
 * - GET  /api/seed/team/:teamId - Check if team exists
 * - GET  /api/seed/site/:siteId?teamId=X - Get site details
 * - POST /api/seed/site - Create a new site
 * - POST /api/seed/events/:siteId - Insert events into site
 */
export const seedApi = route(
  "/api/seed/*",
  async ({ params, request }) => {
    // Validate seed secret for all requests
    const authError = validateSeedSecret(request);
    if (authError) return authError;

    const pathPart = params.$0 ?? "";
    const segments = pathPart.split("/").filter(Boolean);
    const url = new URL(request.url);

    // GET /api/seed/team/:teamId
    if (request.method === "GET" && segments[0] === "team" && segments[1]) {
      const teamId = parseInt(segments[1], 10);
      if (isNaN(teamId)) {
        return new Response("Invalid team ID", { status: 400 });
      }

      const teamDetails = await getTeam(teamId);
      if (!teamDetails) {
        return new Response("Team not found", { status: 404 });
      }

      return Response.json(teamDetails);
    }

    // GET /api/seed/site/:siteId?teamId=X
    if (request.method === "GET" && segments[0] === "site" && segments[1]) {
      const siteId = parseInt(segments[1], 10);
      const teamIdStr = url.searchParams.get("teamId");

      if (isNaN(siteId)) {
        return new Response("Invalid site ID", { status: 400 });
      }
      if (!teamIdStr) {
        return new Response("teamId query param required", { status: 400 });
      }

      const teamId = parseInt(teamIdStr, 10);
      if (isNaN(teamId)) {
        return new Response("Invalid team ID", { status: 400 });
      }

      const siteDetails = await getSite(siteId, teamId);
      if (!siteDetails) {
        return new Response("Site not found", { status: 404 });
      }

      return Response.json(siteDetails);
    }

    // POST /api/seed/site
    if (request.method === "POST" && segments[0] === "site" && !segments[1]) {
      try {
        const body = await request.json() as {
          teamId: number;
          name: string;
          domain: string;
        };

        if (!body.teamId || !body.name || !body.domain) {
          return new Response("teamId, name, and domain are required", { status: 400 });
        }

        // Verify team exists
        const teamDetails = await getTeam(body.teamId);
        if (!teamDetails) {
          return new Response(`Team ${body.teamId} not found`, { status: 404 });
        }

        const site = await createSite(body);
        return Response.json(site, { status: 201 });
      } catch (error) {
        console.error("Error creating site:", error);
        return new Response(
          error instanceof Error ? error.message : "Failed to create site",
          { status: 500 }
        );
      }
    }

    // POST /api/seed/events/:siteId
    if (request.method === "POST" && segments[0] === "events" && segments[1]) {
      const siteId = parseInt(segments[1], 10);
      const teamIdStr = url.searchParams.get("teamId");

      if (isNaN(siteId)) {
        return new Response("Invalid site ID", { status: 400 });
      }
      if (!teamIdStr) {
        return new Response("teamId query param required", { status: 400 });
      }

      const teamId = parseInt(teamIdStr, 10);
      if (isNaN(teamId)) {
        return new Response("Invalid team ID", { status: 400 });
      }

      // Get site details
      const siteDetails = await getSite(siteId, teamId);
      if (!siteDetails) {
        return new Response("Site not found", { status: 404 });
      }

      try {
        const events = await request.json() as SiteEventInput[];
        if (!Array.isArray(events)) {
          return new Response("Events must be an array", { status: 400 });
        }

        const siteAdapter = (siteDetails.site_db_adapter ?? "sqlite") as DBAdapter;
        const result = await seedEvents(siteId, siteDetails.uuid, siteAdapter, events);

        if (result.success) {
          return Response.json({
            success: true,
            inserted: result.inserted || 0,
          });
        }

        return Response.json({ success: false, error: result.error }, { status: 500 });
      } catch (error) {
        console.error("Error seeding events:", error);
        return new Response(
          error instanceof Error ? error.message : "Failed to seed events",
          { status: 500 }
        );
      }
    }

    return new Response("Not Found", { status: 404 });
  }
);
