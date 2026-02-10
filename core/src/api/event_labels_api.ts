import { route, prefix } from "rwsdk/router";
import type { RequestInfo } from "rwsdk/worker";
import type { AppContext } from "@/worker";
import { onlyAllowPost } from "@utilities/route_interuptors";
import { d1_client } from "@db/d1/client";
import { eventLabels } from "@db/d1/schema";
import { eq, and } from "drizzle-orm";
import { getSiteFromContext } from "@/api/authMiddleware";
import { IS_DEV } from "rwsdk/constants";

// GET /api/event-labels?site_id=123
const getEventLabels = route<RequestInfo<any, AppContext>>("/event-labels", [
  async ({ request, ctx }) => {
    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }

    const url = new URL(request.url);
    const siteIdParam = url.searchParams.get("site_id");
    const siteId = siteIdParam ? parseInt(siteIdParam, 10) : null;

    if (!siteId || isNaN(siteId)) {
      return new Response(JSON.stringify({ error: "site_id required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Verify site belongs to team
    const siteDetails = getSiteFromContext(ctx, siteId);
    if (!siteDetails) {
      return new Response(JSON.stringify({ error: "Site not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const labels = await d1_client
      .select()
      .from(eventLabels)
      .where(eq(eventLabels.site_id, siteId));

    return new Response(JSON.stringify(labels), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },
]);

// POST /api/event-labels/save
const saveEventLabel = route<RequestInfo<any, AppContext>>("/event-labels/save", [
  onlyAllowPost,
  async ({ request, ctx }) => {
    const body = (await request.json()) as {
      site_id: number;
      event_name: string;
      label: string;
      description?: string;
    };

    if (!body.site_id || !body.event_name || !body.label) {
      return new Response(
        JSON.stringify({ error: "site_id, event_name, and label required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Verify site belongs to team
    const siteDetails = getSiteFromContext(ctx, body.site_id);
    if (!siteDetails) {
      return new Response(JSON.stringify({ error: "Site not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Check if user has at least editor role
    if (ctx.user_role === "viewer") {
      return new Response(
        JSON.stringify({ error: "You need editor or admin permissions to edit labels" }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Check if label exists, upsert
    const existing = await d1_client
      .select()
      .from(eventLabels)
      .where(
        and(
          eq(eventLabels.site_id, body.site_id),
          eq(eventLabels.event_name, body.event_name)
        )
      )
      .limit(1);

    let result;
    if (existing.length > 0) {
      result = await d1_client
        .update(eventLabels)
        .set({
          label: body.label,
          description: body.description ?? null,
        })
        .where(eq(eventLabels.id, existing[0].id))
        .returning();
    } else {
      result = await d1_client
        .insert(eventLabels)
        .values({
          site_id: body.site_id,
          event_name: body.event_name,
          label: body.label,
          description: body.description ?? null,
        })
        .returning();
    }

    if (IS_DEV) console.log("Event label saved:", result[0]);

    return new Response(JSON.stringify(result[0]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },
]);

// POST /api/event-labels/delete
const deleteEventLabel = route<RequestInfo<any, AppContext>>("/event-labels/delete", [
  onlyAllowPost,
  async ({ request, ctx }) => {
    const body = (await request.json()) as {
      site_id: number;
      event_name: string;
    };

    if (!body.site_id || !body.event_name) {
      return new Response(
        JSON.stringify({ error: "site_id and event_name required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const siteDetails = getSiteFromContext(ctx, body.site_id);
    if (!siteDetails) {
      return new Response(JSON.stringify({ error: "Site not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Check if user has at least editor role
    if (ctx.user_role === "viewer") {
      return new Response(
        JSON.stringify({ error: "You need editor or admin permissions to delete labels" }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    await d1_client
      .delete(eventLabels)
      .where(
        and(
          eq(eventLabels.site_id, body.site_id),
          eq(eventLabels.event_name, body.event_name)
        )
      );

    if (IS_DEV) console.log("Event label deleted:", body.event_name);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },
]);

// Group all event label routes under /api prefix
export const eventLabelsApi = prefix<"/", RequestInfo<any, AppContext>>("/", [
  getEventLabels,
  saveEventLabel,
  deleteEventLabel,
]);
