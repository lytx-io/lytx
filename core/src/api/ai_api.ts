import { env } from "cloudflare:workers";
import { route } from "rwsdk/router";
import type { RequestInfo } from "rwsdk/worker";
import { generateText, streamText, tool } from "ai";
import { IS_DEV } from "rwsdk/constants";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { z } from "zod";

import type { AppContext } from "@/worker";
import { getSiteFromContext } from "@/api/authMiddleware";
import {
  getDurableDatabaseStub,
  getMetricsFromDurableObject,
  getStatsFromDurableObject,
  getTimeSeriesFromDurableObject,
} from "@db/durable/durableObjectClient";
import { parseDateParam, parseSiteIdParam } from "@/utilities/dashboardParams";

type AiConfig = {
  baseURL: string;
  model: string;
  apiKey: string;
};

const DEFAULT_AI_MODEL = "gpt-4o-mini";
const DEFAULT_AI_BASE_URL = "https://api.openai.com/v1";
const MAX_METRIC_LIMIT = 100;

function getAiConfigFromEnv(): AiConfig | null {
  const baseURL = env.AI_BASE_URL?.trim() || DEFAULT_AI_BASE_URL;
  const model = env.AI_MODEL?.trim() || DEFAULT_AI_MODEL;
  const apiKey = env.AI_API_KEY?.trim() ?? "";

  if (!apiKey) return null;

  return { baseURL, model, apiKey };
}

function clampLimit(value: unknown, fallback = 10): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(MAX_METRIC_LIMIT, Math.floor(parsed)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function truncateUtf8(input: string, maxBytes: number): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(input);
  if (bytes.length <= maxBytes) return input;

  const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(0, maxBytes));
  return decoded;
}

function isPrivateNetworkHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (lower === "localhost" || lower.endsWith(".localhost")) return true;

  const ipv4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(lower);
  if (!ipv4Match) return false;

  const octets = ipv4Match.slice(1).map((o) => parseInt(o, 10));
  if (octets.some((o) => Number.isNaN(o) || o < 0 || o > 255)) return true;

  const [a, b] = octets;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;

  return false;
}

function looksLikeIPAddress(hostname: string): boolean {
  // URL.hostname strips brackets for IPv6 (e.g. "::1")
  if (hostname.includes(":")) return true;
  return /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(hostname);
}

function normalizeUrl(input: string): URL | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

function extractScriptSrcs(html: string): string[] {
  const results: string[] = [];
  const scriptTagRegex = /<script\b[^>]*\bsrc\s*=\s*("([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>/gi;

  for (const match of html.matchAll(scriptTagRegex)) {
    const src = match[2] || match[3] || match[4];
    if (src) results.push(src);
  }

  return Array.from(new Set(results));
}

function inferHostMatchesDomain(hostname: string, domain: string | null | undefined): boolean {
  if (!domain) return true;

  const normalizedDomain = domain.trim().toLowerCase();
  if (!normalizedDomain) return true;

  const lowerHost = hostname.toLowerCase();
  return lowerHost === normalizedDomain || lowerHost.endsWith(`.${normalizedDomain}`);
}

function getSiteTagSystemPrompt() {
  return `You are a web analytics instrumentation assistant.

Goal:
- Suggest the best DOM events to track on a given page (clicks, submits, nav, CTAs).
- Use privacy-safe guidance: avoid collecting PII (emails, names, phone numbers).
- Output should be concise and actionable.

When recommending Lytx event tracking:
- Use a custom event name like "cta_click" or "signup_submit".
- Recommend JavaScript that checks for window.lytxApi and calls:
  window.lytxApi.trackCustomEvents(TAG_ID, "web", { custom: EVENT_NAME }, "")
- Avoid high-cardinality event names.

Return format:
- 3-6 suggested events with selectors and rationale
- 1 code snippet that attaches listeners
- A short validation note if tag is missing.`;
}

function getAiConfig(teamId?: number | null): AiConfig | null {
  return getAiConfigFromEnv();
}

function getSchemaPrompt() {
  return `You are an analytics data assistant.

Your job:
- Answer user questions about their analytics data.
- If the data is needed, call an available tool to fetch results.
- If a tool cannot answer, provide an optimized SQL query instead.
- Prefer concise responses: 2-6 bullet points plus a SQL block when needed.

Data schema (core tables):

D1 (SQLite / Durable Object sources):
- team: { id, name, uuid, external_id, db_adapter }
- team_member: { team_id, user_id, role, allowed_site_ids }
- sites: { site_id, uuid, tag_id, team_id, name, domain, track_web_events, external_id, site_db_adapter, createdAt }
- site_events: { id, team_id, site_id, tag_id, event, createdAt, page_url, client_page_url, referer, rid, device_type, browser, operating_system, country, region, city, postal, screen_width, screen_height, custom_data(json), query_params(json), bot_data(json) }

Postgres (if team/site is mapped via external_id):
- accounts: { account_id, name, website }
- sites: { site_id, account_id, domain, track_web_events }
- site_events: { id, account_id, site_id, tag_id, event, created_at, page_url, client_page_url, referer, rid, device_type, browser, operating_system, country, region, city, postal, screen_width, screen_height, custom_data(jsonb), query_params(jsonb), bot_data(jsonb) }

Conventions:
- Always filter by team scope:
  - D1: use site_events.team_id = {{team_id}}
  - Postgres: use site_events.account_id = {{team_external_id}}
- When site specific:
  - D1: site_events.site_id = {{site_id}}
  - Postgres: site_events.site_id = {{site_external_id}} (or {{site_id}} if not mapped)
- Use a date range if the question implies it (e.g. last 7/30 days).
- Use indexes-friendly patterns: date filter + group by + limit.

Return format:
- A brief explanation
- Results summary (if tool data is available)
- A SQL query only when needed (or multiple options if D1 vs Postgres differ)`;
}

function getTeamContextPrompt(ctx: AppContext, siteId: number | null) {
  const site = siteId ? ctx.sites?.find((s) => s.site_id === siteId) : null;

  const teamId = ctx.team?.id ?? "unknown";
  const teamExternalId = ctx.team?.external_id ?? 0;

  const siteExternalId = site?.external_id ?? 0;
  const siteDomain = site?.domain ?? null;

  return `Current request context:
- team_id: ${teamId}
- team_external_id (postgres account_id): ${teamExternalId}
- site_id: ${siteId ?? "none"}
- site_external_id (postgres site_id): ${siteExternalId}
- site_domain: ${siteDomain ?? "unknown"}

Available tools:
- get_site_stats: summary metrics for a site (counts by event/country/device/referer).
- get_time_series: time series counts with granularity and optional grouping by event.
- get_metric_breakdown: top counts for events/countries/devices/referers/pages.
Use tools when you need real data. If a tool fails or data is missing, explain and provide SQL instead.`;
}

export const aiConfigRoute = route(
  "/ai/config",
  async ({ request }: RequestInfo<any, AppContext>) => {
    if (request.method !== "GET") {
      return new Response("Not Found.", { status: 404 });
    }

    const config = getAiConfig();

    return new Response(
      JSON.stringify({
        configured: Boolean(config),
        model: config?.model ?? "",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  },
);

export const aiTagSuggestRoute = route(
  "/ai/site-tag-suggest",
  async ({ request, ctx }: RequestInfo<any, AppContext>) => {
    const requestId = crypto.randomUUID();

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed", requestId }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const config = getAiConfig(ctx.team.id);
    const aiConfigured = Boolean(config);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body", requestId }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!isRecord(body)) {
      return new Response(JSON.stringify({ error: "Invalid body", requestId }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const urlInput = typeof body.url === "string" ? body.url : "";
    const url = normalizeUrl(urlInput);
    if (!url) {
      return new Response(JSON.stringify({ error: "url must be a valid http(s) URL", requestId }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (looksLikeIPAddress(url.hostname) || isPrivateNetworkHostname(url.hostname)) {
      return new Response(JSON.stringify({ error: "url hostname is not allowed", requestId }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const siteIdRaw = body.site_id;
    const siteId = typeof siteIdRaw === "number" && Number.isInteger(siteIdRaw)
      ? siteIdRaw
      : typeof siteIdRaw === "string" && siteIdRaw.trim() !== "" && !Number.isNaN(Number(siteIdRaw))
        ? parseInt(siteIdRaw, 10)
        : null;

    if (!siteId) {
      return new Response(JSON.stringify({ error: "site_id is required", requestId }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const site = getSiteFromContext(ctx, siteId);
    if (!site || !site.uuid) {
      return new Response(JSON.stringify({ error: "Site not found", requestId }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!inferHostMatchesDomain(url.hostname, site.domain ?? null)) {
      return new Response(
        JSON.stringify({
          error: "URL hostname does not match selected site domain",
          requestId,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (url.protocol !== "https:" && !IS_DEV) {
      return new Response(JSON.stringify({ error: "HTTPS URL required", requestId }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    let html = "";
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const resp = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "User-Agent": "LytxBot/1.0 (+https://lytx.io)",
          Accept: "text/html,application/xhtml+xml",
        },
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      if (!resp.ok) {
        return new Response(
          JSON.stringify({ error: `Failed to fetch URL (HTTP ${resp.status})`, requestId }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      const contentType = resp.headers.get("content-type")?.toLowerCase() ?? "";
      if (!contentType.includes("text/html")) {
        return new Response(JSON.stringify({ error: "URL did not return HTML", requestId }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      html = await resp.text();
    } catch (error) {
      console.error("site-tag-suggest fetch failed", { requestId, error });
      return new Response(JSON.stringify({ error: "Failed to fetch URL", requestId }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const tagId = site.tag_id_override ?? site.tag_id;
    if (!tagId) {
      return new Response(JSON.stringify({ error: "Site tag id is missing", requestId }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const srcCandidates = extractScriptSrcs(html)
      .map((src) => {
        try {
          return new URL(src, url).toString();
        } catch {
          return src;
        }
      });

    const tagFound = srcCandidates.some((src) => {
      try {
        const parsed = new URL(src);
        if (!/lytx(\.v2)?\.js$/i.test(parsed.pathname)) return false;
        return parsed.searchParams.get("account") === tagId;
      } catch {
        return false;
      }
    }) || new RegExp(`lytx(\\.v2)?\\.js\\?[^\"']*account=${escapeRegExp(tagId)}`, "i").test(html);

    let trackingOk: boolean | null = null;
    try {
      const stub = await getDurableDatabaseStub(site.uuid, site.site_id);
      const health = await stub.healthCheck();
      trackingOk = Boolean(health && (health.totalEvents ?? 0) > 0);
    } catch (error) {
      if (IS_DEV) console.warn("site-tag-suggest durable health check failed", { requestId, error });
      trackingOk = null;
    }

    if (!aiConfigured) {
      return new Response(
        JSON.stringify({
          requestId,
          url: url.toString(),
          site_id: site.site_id,
          domain: site.domain,
          tagId,
          tagFound,
          trackingOk,
          aiConfigured,
          suggestion:
            "AI is not configured for this team. Configure the AI SDK environment variables to generate event recommendations.",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const aiConfig = config;
    if (!aiConfig) {
      return new Response(JSON.stringify({ error: "AI is not configured for this team", requestId }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const modelProvider = createOpenAICompatible({
      baseURL: aiConfig.baseURL,
      name: "team-model",
      apiKey: aiConfig.apiKey,
    });

    const prompt = `Analyze this page HTML and suggest DOM events to track.\n\nContext:\n- Selected site domain: ${site.domain ?? "unknown"}\n- Target URL: ${url.toString()}\n- Lytx tag id (account): ${tagId}\n- Tag script detected on page: ${tagFound}\n- Tracking events seen recently: ${trackingOk === null ? "unknown" : trackingOk}\n\nHTML (truncated):\n${truncateUtf8(html, 60_000)}`;

    try {
      const result = await generateText({
        model: modelProvider.chatModel(aiConfig.model),
        system: getSiteTagSystemPrompt(),
        prompt,
      });

      return new Response(
        JSON.stringify({
          requestId,
          url: url.toString(),
          site_id: site.site_id,
          domain: site.domain,
          tagId,
          tagFound,
          trackingOk,
          aiConfigured,
          suggestion: result.text,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      console.error("site-tag-suggest ai error", { requestId, error });
      return new Response(JSON.stringify({ error: "AI request failed", requestId }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
);

export const aiChatRoute = route(
  "/ai/chat",
  async ({ request, ctx }: RequestInfo<any, AppContext>) => {
    const requestId = crypto.randomUUID();

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed", requestId }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const aiConfig = getAiConfig(ctx.team.id);
    if (!aiConfig) {
      return new Response(
        JSON.stringify({ error: "AI is not configured for this team", requestId }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body", requestId }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!isRecord(body)) {
      return new Response(JSON.stringify({ error: "Invalid body", requestId }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const messages = Array.isArray(body.messages) ? body.messages : null;
    const siteId = parseSiteIdParam(body.site_id ?? null);

    if (!messages) {
      return new Response(JSON.stringify({ error: "messages is required", requestId }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const modelProvider = createOpenAICompatible({
      baseURL: aiConfig.baseURL,
      name: "team-model",
      apiKey: aiConfig.apiKey,
    });

    const system = `${getSchemaPrompt()}\n\n${getTeamContextPrompt(ctx, siteId)}`;

    const tools = {
      get_site_stats: tool({
        description: "Return summary metrics for a site over a date range.",
        parameters: z.object({
          site_id: z.number().describe("Site id to query"),
          startDate: z.string().optional().describe("ISO start date"),
          endDate: z.string().optional().describe("ISO end date"),
        }),
        execute: async ({ site_id, startDate, endDate }) => {
          const site = getSiteFromContext(ctx, site_id);
          if (!site?.uuid) {
            return { error: "Site not found" };
          }

          const stats = await getStatsFromDurableObject({
            site_id: site.site_id,
            site_uuid: site.uuid,
            team_id: ctx.team?.id ?? 0,
            date: {
              start: parseDateParam(startDate) ?? undefined,
              end: parseDateParam(endDate) ?? undefined,
            },
          });

          if (!stats) {
            return { error: "No stats available" };
          }

          return stats;
        },
      }),
      get_time_series: tool({
        description: "Return time series counts for a site.",
        parameters: z.object({
          site_id: z.number().describe("Site id to query"),
          startDate: z.string().optional().describe("ISO start date"),
          endDate: z.string().optional().describe("ISO end date"),
          granularity: z.enum(["hour", "day", "week", "month"]).optional(),
          byEvent: z.boolean().optional(),
        }),
        execute: async ({ site_id, startDate, endDate, granularity, byEvent }) => {
          const site = getSiteFromContext(ctx, site_id);
          if (!site?.uuid) {
            return { error: "Site not found" };
          }

          const result = await getTimeSeriesFromDurableObject({
            site_id: site.site_id,
            site_uuid: site.uuid,
            team_id: ctx.team?.id ?? 0,
            date: {
              start: parseDateParam(startDate) ?? undefined,
              end: parseDateParam(endDate) ?? undefined,
            },
            granularity,
            byEvent: Boolean(byEvent),
          });

          if (!result) {
            return { error: "No time series available" };
          }

          return result;
        },
      }),
      get_metric_breakdown: tool({
        description: "Return top metrics for events, countries, devices, referers, or pages.",
        parameters: z.object({
          site_id: z.number().describe("Site id to query"),
          metricType: z.enum(["events", "countries", "devices", "referers", "pages"]),
          limit: z.number().optional().describe("Max number of rows"),
          startDate: z.string().optional().describe("ISO start date"),
          endDate: z.string().optional().describe("ISO end date"),
        }),
        execute: async ({ site_id, metricType, limit, startDate, endDate }) => {
          const site = getSiteFromContext(ctx, site_id);
          if (!site?.uuid) {
            return { error: "Site not found" };
          }

          const result = await getMetricsFromDurableObject({
            site_id: site.site_id,
            site_uuid: site.uuid,
            team_id: ctx.team?.id ?? 0,
            metricType,
            limit: clampLimit(limit, 10),
            date: {
              start: parseDateParam(startDate) ?? undefined,
              end: parseDateParam(endDate) ?? undefined,
            },
          });

          if (!result) {
            return { error: "No metrics available" };
          }

          return result;
        },
      }),
    };

    try {
      const result = streamText({
        model: modelProvider.chatModel(aiConfig.model),
        system,
        messages: messages.slice(-20) as any,
        tools,
      });

      return result.toDataStreamResponse({
        headers: {
          "x-request-id": requestId,
        },
      });
    } catch (error) {
      console.error("AI chat error", { requestId, error });
      return new Response(
        JSON.stringify({ error: "AI chat failed", requestId }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  },
);
