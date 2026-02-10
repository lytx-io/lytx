import type { RequestInfo } from "rwsdk/worker";
import type { AppContext } from "@/worker";
import { d1_client } from "@db/d1/client";
import { customReports } from "@db/d1/schema";
import { and, desc, eq } from "drizzle-orm";
import { getSiteFromContext } from "@/api/authMiddleware";

const parseSiteId = (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return Math.floor(numeric);
};

const parseReportUuidFromPath = (requestUrl: string) => {
  const pathname = new URL(requestUrl).pathname;
  const marker = "/api/reports/custom/";
  const markerIndex = pathname.indexOf(marker);
  if (markerIndex < 0) return null;

  const raw = pathname.slice(markerIndex + marker.length).trim();
  if (!raw || raw.includes("/")) return null;
  return decodeURIComponent(raw);
};

const listOrCreateCustomReports = route<RequestInfo<any, AppContext>>("/reports/custom", [
  async ({ request, ctx }) => {
    if (request.method === "GET") {
      const url = new URL(request.url);
      const siteIdParam = url.searchParams.get("site_id");
      const parsedSiteId = siteIdParam ? parseSiteId(siteIdParam) : null;

      if (siteIdParam && !parsedSiteId) {
        return new Response(JSON.stringify({ error: "site_id must be a valid number" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (parsedSiteId) {
        const site = getSiteFromContext(ctx, parsedSiteId);
        if (!site) {
          return new Response(JSON.stringify({ error: "Site not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }
      }

      const reports = parsedSiteId
        ? await d1_client
          .select()
          .from(customReports)
          .where(and(eq(customReports.team_id, ctx.team.id), eq(customReports.site_id, parsedSiteId)))
          .orderBy(desc(customReports.updatedAt))
        : await d1_client
          .select()
          .from(customReports)
          .where(eq(customReports.team_id, ctx.team.id))
          .orderBy(desc(customReports.updatedAt));

      return new Response(JSON.stringify({ reports }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (ctx.user_role === "viewer") {
      return new Response(JSON.stringify({ error: "You need editor or admin permissions to create reports" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const payload = (await request.json().catch(() => null)) as
      | {
        site_id?: unknown;
        name?: unknown;
        description?: unknown;
        config?: unknown;
      }
      | null;

    const siteId = parseSiteId(payload?.site_id);
    const name = typeof payload?.name === "string" ? payload.name.trim() : "";
    const description = typeof payload?.description === "string" ? payload.description.trim() : null;
    const config = payload?.config;

    if (!siteId) {
      return new Response(JSON.stringify({ error: "site_id is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!name) {
      return new Response(JSON.stringify({ error: "name is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!config || typeof config !== "object") {
      return new Response(JSON.stringify({ error: "config is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const site = getSiteFromContext(ctx, siteId);
    if (!site) {
      return new Response(JSON.stringify({ error: "Site not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const uuid = crypto.randomUUID();
    const userId = ((ctx.session as { user?: { id?: string } })?.user?.id || "unknown").toString();

    await d1_client.insert(customReports).values({
      uuid,
      team_id: ctx.team.id,
      site_id: siteId,
      name,
      description,
      config: config as Record<string, unknown>,
      created_by: userId,
    });

    return new Response(JSON.stringify({ uuid }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  },
]);

const getOrUpdateCustomReport = route<RequestInfo<any, AppContext>>("/reports/custom/*", [
  async ({ request, ctx }) => {
    const reportUuid = parseReportUuidFromPath(request.url);
    if (!reportUuid) {
      return new Response(JSON.stringify({ error: "Invalid report id" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const existing = await d1_client
      .select()
      .from(customReports)
      .where(and(eq(customReports.uuid, reportUuid), eq(customReports.team_id, ctx.team.id)))
      .limit(1);

    if (existing.length === 0) {
      return new Response(JSON.stringify({ error: "Report not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const report = existing[0];
    const site = getSiteFromContext(ctx, report.site_id);
    if (!site) {
      return new Response(JSON.stringify({ error: "Site not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (request.method === "GET") {
      return new Response(JSON.stringify({ report }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (ctx.user_role === "viewer") {
      return new Response(JSON.stringify({ error: "You need editor or admin permissions to update reports" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const payload = (await request.json().catch(() => null)) as
      | {
        site_id?: unknown;
        name?: unknown;
        description?: unknown;
        config?: unknown;
      }
      | null;

    const siteId = parseSiteId(payload?.site_id);
    const name = typeof payload?.name === "string" ? payload.name.trim() : "";
    const description = typeof payload?.description === "string" ? payload.description.trim() : null;
    const config = payload?.config;

    if (!siteId) {
      return new Response(JSON.stringify({ error: "site_id is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!name) {
      return new Response(JSON.stringify({ error: "name is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!config || typeof config !== "object") {
      return new Response(JSON.stringify({ error: "config is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const targetSite = getSiteFromContext(ctx, siteId);
    if (!targetSite) {
      return new Response(JSON.stringify({ error: "Site not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    await d1_client
      .update(customReports)
      .set({
        site_id: siteId,
        name,
        description,
        config: config as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .where(eq(customReports.id, report.id));

    return new Response(JSON.stringify({ uuid: reportUuid }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },
]);

export const reportsApi = prefix<"/", RequestInfo<any, AppContext>>("/", [
  listOrCreateCustomReports,
  getOrUpdateCustomReport,
]);
