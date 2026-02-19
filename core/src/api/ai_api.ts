import { env } from "cloudflare:workers";
import { route } from "rwsdk/router";
import type { RequestInfo } from "rwsdk/worker";
import { convertToModelMessages, generateText, streamText, tool } from "ai";
import { IS_DEV } from "rwsdk/constants";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { z } from "zod";

import type { AppContext } from "@/types/app-context";
import { getSiteFromContext } from "@/api/authMiddleware";
import {
  getDurableDatabaseStub,
  getMetricsFromDurableObject,
  getStatsFromDurableObject,
  getTimeSeriesFromDurableObject,
} from "@db/durable/durableObjectClient";
import {
  getTeamAiUsageForUtcDay,
  trackTeamAiUsage,
  type TrackTeamAiUsageInput,
} from "@db/d1/teamAiUsage";
import { parseDateParam, parseSiteIdParam } from "@/utilities/dashboardParams";

type AiConfig = {
  baseURL: string;
  model: string;
  apiKey: string;
};

type NivoChartType = "bar" | "line" | "pie";

const DEFAULT_AI_MODEL = "gpt-5-mini";
const DEFAULT_AI_BASE_URL = "https://api.openai.com/v1";
const MAX_METRIC_LIMIT = 100;

type TokenUsage = {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
};

type StreamCompletionSummary = {
  finishReason: string;
  toolCallCount: number;
  completionChars: number;
  stepCount: number;
  usageFromOnFinish: unknown;
};

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

function asOptionalNonNegativeInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }

  if (typeof value === "bigint") {
    if (value < 0n) return 0;
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
      return Number.MAX_SAFE_INTEGER;
    }
    return Number(value);
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    return Math.max(0, Math.floor(parsed));
  }

  return null;
}

function extractTokenUsage(value: unknown): TokenUsage {
  if (!isRecord(value)) {
    return {
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
    };
  }

  const inputTokens = asOptionalNonNegativeInt(
    value.inputTokens
    ?? value.promptTokens
    ?? value.prompt_tokens,
  );
  const outputTokens = asOptionalNonNegativeInt(
    value.outputTokens
    ?? value.completionTokens
    ?? value.completion_tokens,
  );

  const explicitTotal = asOptionalNonNegativeInt(
    value.totalTokens
    ?? value.total_tokens,
  );

  const derivedTotal =
    inputTokens !== null || outputTokens !== null
      ? (inputTokens ?? 0) + (outputTokens ?? 0)
      : null;

  return {
    inputTokens,
    outputTokens,
    totalTokens: explicitTotal ?? derivedTotal,
  };
}

function getAiDailyTokenLimit(): number | null {
  const rawValue = (env as unknown as Record<string, unknown>).AI_DAILY_TOKEN_LIMIT;
  const raw = typeof rawValue === "string" ? rawValue.trim() : "";
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
}

async function isTeamOverAiDailyLimit(teamId: number): Promise<{ limited: boolean; usedTokens: number; limit: number | null }> {
  const limit = getAiDailyTokenLimit();
  if (!limit) {
    return { limited: false, usedTokens: 0, limit: null };
  }

  const totals = await getTeamAiUsageForUtcDay(teamId);
  return {
    limited: totals.totalTokens >= limit,
    usedTokens: totals.totalTokens,
    limit,
  };
}

async function trackAiUsageSafely(input: TrackTeamAiUsageInput) {
  try {
    await trackTeamAiUsage(input);
  } catch (error) {
    if (IS_DEV) {
      console.warn("Failed to persist AI usage", {
        requestId: input.request_id,
        error,
      });
    }
  }
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

function previewText(input: string, maxLength = 140): string {
  const normalized = input.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}...`;
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

export function getAiConfig(_teamId?: number | null): AiConfig | null {
  return getAiConfigFromEnv();
}

function getSchemaPrompt() {
  return `You are an analytics data assistant.

Your job:
- Answer user questions about their analytics data.
- If the data is needed, call an available tool to fetch results.
- Prefer concise responses: 2-6 bullets with plain-language insights.
- Do not include SQL unless the user explicitly asks for SQL.
- Do not mention D1, Durable Object internals, or Postgres unless the user explicitly asks about implementation details.
- If the user explicitly asks for a chart/graph/visualization, call get_nivo_chart_data.
- Do not call get_nivo_chart_data unless the user asks for a visual/chart.
- When you return a chart, also include a short plain-language summary of what the chart shows.

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
- Optional next-step suggestion (only if useful)`;
}

function getTeamContextPrompt(ctx: AppContext, requestedSiteId: number | null, defaultSiteId: number | null) {
  const site = defaultSiteId ? ctx.sites?.find((s) => s.site_id === defaultSiteId) : null;

  const teamId = ctx.team?.id ?? "unknown";
  const teamExternalId = ctx.team?.external_id ?? 0;

  const siteExternalId = site?.external_id ?? 0;
  const siteDomain = site?.domain ?? null;
  const availableSites = (ctx.sites ?? [])
    .map((s) => `- ${s.site_id}: ${s.name || s.domain || `Site ${s.site_id}`}${s.domain ? ` (${s.domain})` : ""}`)
    .join("\n") || "- none";

  return `Current request context:
- team_id: ${teamId}
- team_external_id (postgres account_id): ${teamExternalId}
- requested_site_id_from_client: ${requestedSiteId ?? "none"}
- default_site_id_for_tools: ${defaultSiteId ?? "none"}
- site_external_id (postgres site_id): ${siteExternalId}
- site_domain: ${siteDomain ?? "unknown"}

Accessible sites for this user:
${availableSites}

Available tools:
- get_site_stats: summary metrics for a site (counts by event/country/device/referer).
- get_time_series: time series counts with granularity and optional grouping by event.
- get_metric_breakdown: top counts for events/countries/devices/referers/pages.
- get_nivo_chart_data: returns chart-ready data for Nivo charts when the user asks for a chart.
Use tools when you need real data. If a tool fails or data is missing, explain the limitation in plain language.
When a site-specific query is needed, default to default_site_id_for_tools and do not ask for site_id unless user explicitly asks for a different site.`;
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
    }) || new RegExp(`lytx(\\.v2)?\\.js\\?[^"']*account=${escapeRegExp(tagId)}`, "i").test(html);

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

    const dailyLimitState = await isTeamOverAiDailyLimit(ctx.team.id);
    if (dailyLimitState.limited) {
      await trackAiUsageSafely({
        team_id: ctx.team.id,
        user_id: ctx.session.user.id,
        site_id: site.site_id,
        request_id: requestId,
        request_type: "site_tag_suggest",
        provider: aiConfig.baseURL,
        model: aiConfig.model,
        status: "error",
        error_code: "daily_limit_exceeded",
      });
      return new Response(
        JSON.stringify({
          error: "AI daily usage limit reached for this team. Try again tomorrow UTC.",
          requestId,
          used_tokens: dailyLimitState.usedTokens,
          token_limit: dailyLimitState.limit,
        }),
        {
          status: 429,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const modelProvider = createOpenAICompatible({
      baseURL: aiConfig.baseURL,
      name: "team-model",
      apiKey: aiConfig.apiKey,
      includeUsage: true,
    });

    const prompt = `Analyze this page HTML and suggest DOM events to track.\n\nContext:\n- Selected site domain: ${site.domain ?? "unknown"}\n- Target URL: ${url.toString()}\n- Lytx tag id (account): ${tagId}\n- Tag script detected on page: ${tagFound}\n- Tracking events seen recently: ${trackingOk === null ? "unknown" : trackingOk}\n\nHTML (truncated):\n${truncateUtf8(html, 60_000)}`;
    const aiStartedAt = Date.now();

    try {
      const result = await generateText({
        model: modelProvider.chatModel(aiConfig.model),
        system: getSiteTagSystemPrompt(),
        prompt,
      });

      const usage = extractTokenUsage((result as { usage?: unknown }).usage);
      void trackAiUsageSafely({
        team_id: ctx.team.id,
        user_id: ctx.session.user.id,
        site_id: site.site_id,
        request_id: requestId,
        request_type: "site_tag_suggest",
        provider: aiConfig.baseURL,
        model: aiConfig.model,
        status: "success",
        input_tokens: usage.inputTokens,
        output_tokens: usage.outputTokens,
        total_tokens: usage.totalTokens,
        tool_calls: 0,
        message_count: 1,
        prompt_chars: prompt.length,
        completion_chars: result.text.length,
        duration_ms: Date.now() - aiStartedAt,
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
      await trackAiUsageSafely({
        team_id: ctx.team.id,
        user_id: ctx.session.user.id,
        site_id: site.site_id,
        request_id: requestId,
        request_type: "site_tag_suggest",
        provider: aiConfig.baseURL,
        model: aiConfig.model,
        status: "error",
        error_code: "ai_request_failed",
        error_message: truncateUtf8(error instanceof Error ? error.message : "Unknown AI error", 500),
        message_count: 1,
        prompt_chars: prompt.length,
        duration_ms: Date.now() - aiStartedAt,
      });
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
    const debugStream = IS_DEV && (
      body.debug_stream === true
      || request.headers.get("x-ai-debug-stream") === "1"
      || new URL(request.url).searchParams.get("debug_stream") === "1"
      || (env as any).AI_STREAM_DEBUG === "1"
    );

    if (!messages) {
      return new Response(JSON.stringify({ error: "messages is required", requestId }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const aiRequestStartedAt = Date.now();
    const trimmedMessages = messages.slice(-20) as any;
    const promptCharsEstimate = JSON.stringify(trimmedMessages).length;
    const selectedSite = siteId ? getSiteFromContext(ctx, siteId) : null;
    const fallbackSite = selectedSite ?? (ctx.sites?.[0] ?? null);
    const defaultToolSiteId = fallbackSite?.site_id ?? null;

    const dailyLimitState = await isTeamOverAiDailyLimit(ctx.team.id);
    if (dailyLimitState.limited) {
      await trackAiUsageSafely({
        team_id: ctx.team.id,
        user_id: ctx.session.user.id,
        site_id: defaultToolSiteId,
        request_id: requestId,
        request_type: "chat",
        provider: aiConfig.baseURL,
        model: aiConfig.model,
        status: "error",
        error_code: "daily_limit_exceeded",
        message_count: messages.length,
        prompt_chars: promptCharsEstimate,
      });
      return new Response(
        JSON.stringify({
          error: "AI daily usage limit reached for this team. Try again tomorrow UTC.",
          requestId,
          used_tokens: dailyLimitState.usedTokens,
          token_limit: dailyLimitState.limit,
        }),
        {
          status: 429,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const modelProvider = createOpenAICompatible({
      baseURL: aiConfig.baseURL,
      name: "team-model",
      apiKey: aiConfig.apiKey,
      includeUsage: true,
    });

    const system = `${getSchemaPrompt()}\n\n${getTeamContextPrompt(ctx, siteId, defaultToolSiteId)}`;

    const tools = {
      get_site_stats: tool({
        description: "Return summary metrics for a site over a date range.",
        inputSchema: z.object({
          site_id: z.number().optional().describe("Site id to query (optional, defaults to selected site)"),
          startDate: z.string().optional().describe("ISO start date"),
          endDate: z.string().optional().describe("ISO end date"),
        }),
        execute: async ({ site_id, startDate, endDate }) => {
          const effectiveSiteId = site_id ?? defaultToolSiteId;
          if (!effectiveSiteId) {
            return { error: "No accessible site available" };
          }

          const site = getSiteFromContext(ctx, effectiveSiteId);
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
        inputSchema: z.object({
          site_id: z.number().optional().describe("Site id to query (optional, defaults to selected site)"),
          startDate: z.string().optional().describe("ISO start date"),
          endDate: z.string().optional().describe("ISO end date"),
          granularity: z.enum(["hour", "day", "week", "month"]).optional(),
          byEvent: z.boolean().optional(),
        }),
        execute: async ({ site_id, startDate, endDate, granularity, byEvent }) => {
          const effectiveSiteId = site_id ?? defaultToolSiteId;
          if (!effectiveSiteId) {
            return { error: "No accessible site available" };
          }

          const site = getSiteFromContext(ctx, effectiveSiteId);
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
        inputSchema: z.object({
          site_id: z.number().optional().describe("Site id to query (optional, defaults to selected site)"),
          metricType: z.enum(["events", "countries", "devices", "referers", "pages"]),
          limit: z.number().optional().describe("Max number of rows"),
          startDate: z.string().optional().describe("ISO start date"),
          endDate: z.string().optional().describe("ISO end date"),
        }),
        execute: async ({ site_id, metricType, limit, startDate, endDate }) => {
          const effectiveSiteId = site_id ?? defaultToolSiteId;
          if (!effectiveSiteId) {
            return { error: "No accessible site available" };
          }

          const site = getSiteFromContext(ctx, effectiveSiteId);
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
      get_nivo_chart_data: tool({
        description: "Return chart-ready data for Nivo when user explicitly asks for a chart.",
        inputSchema: z.object({
          chartType: z.enum(["bar", "line", "pie"] as [NivoChartType, ...NivoChartType[]]),
          site_id: z.number().optional().describe("Site id to query (optional, defaults to selected site)"),
          metricType: z.enum(["events", "countries", "devices", "referers", "pages"]).optional(),
          startDate: z.string().optional().describe("ISO start date"),
          endDate: z.string().optional().describe("ISO end date"),
          granularity: z.enum(["hour", "day", "week", "month"]).optional(),
          limit: z.number().optional().describe("Max number of rows"),
          title: z.string().optional().describe("Optional chart title"),
        }),
        execute: async ({ chartType, site_id, metricType, startDate, endDate, granularity, limit, title }) => {
          const effectiveSiteId = site_id ?? defaultToolSiteId;
          if (!effectiveSiteId) {
            return { error: "No accessible site available" };
          }

          const site = getSiteFromContext(ctx, effectiveSiteId);
          if (!site?.uuid) {
            return { error: "Site not found" };
          }

          const defaultMetricType = metricType ?? "events";

          if (chartType === "line") {
            const timeSeries = await getTimeSeriesFromDurableObject({
              site_id: site.site_id,
              site_uuid: site.uuid,
              team_id: ctx.team?.id ?? 0,
              date: {
                start: parseDateParam(startDate) ?? undefined,
                end: parseDateParam(endDate) ?? undefined,
              },
              granularity,
              byEvent: false,
            });

            if (!timeSeries) {
              return { error: "No time series available" };
            }

            return {
              kind: "nivo-chart",
              chartType,
              title: title || `${site.name || `Site ${site.site_id}`} trend`,
              metricType: defaultMetricType,
              siteId: site.site_id,
              dateRange: timeSeries.dateRange,
              points: timeSeries.data.map((item) => ({ x: item.date, y: item.count })),
            };
          }

          const metricResult = await getMetricsFromDurableObject({
            site_id: site.site_id,
            site_uuid: site.uuid,
            team_id: ctx.team?.id ?? 0,
            metricType: defaultMetricType,
            limit: clampLimit(limit, 10),
            date: {
              start: parseDateParam(startDate) ?? undefined,
              end: parseDateParam(endDate) ?? undefined,
            },
          });

          if (!metricResult) {
            return { error: "No metrics available" };
          }

          return {
            kind: "nivo-chart",
            chartType,
            title: title || `${site.name || `Site ${site.site_id}`} ${defaultMetricType}`,
            metricType: defaultMetricType,
            siteId: site.site_id,
            dateRange: metricResult.dateRange,
            points: metricResult.data.map((item) => ({
              x: item.label || "Unknown",
              y: item.count,
            })),
          };
        },
      }),
    };

    try {
      const modelMessages = await convertToModelMessages(trimmedMessages, {
        tools,
      });

      let resolveStreamSummary!: (summary: StreamCompletionSummary) => void;
      const streamSummaryPromise = new Promise<StreamCompletionSummary>((resolve) => {
        resolveStreamSummary = resolve;
      });
      let hasResolvedStreamSummary = false;
      const settleStreamSummary = (summary: StreamCompletionSummary) => {
        if (hasResolvedStreamSummary) return;
        hasResolvedStreamSummary = true;
        resolveStreamSummary(summary);
      };

      const result = streamText({
        model: modelProvider.chatModel(aiConfig.model),
        system,
        messages: modelMessages,
        tools,
        // stopWhen can be re-enabled after stream debugging if needed.
        onChunk: ({ chunk }) => {
          if (!debugStream) return;

          if (chunk.type === "text-delta") {
            console.log("[AI stream chunk]", {
              requestId,
              type: chunk.type,
              text: previewText(chunk.text, 80),
            });
            return;
          }

          if (chunk.type === "tool-input-start") {
            console.log("[AI stream chunk]", {
              requestId,
              type: chunk.type,
              toolName: chunk.toolName,
            });
            return;
          }

          if (chunk.type === "tool-call") {
            console.log("[AI stream chunk]", {
              requestId,
              type: chunk.type,
              toolName: chunk.toolName,
            });
            return;
          }

          if (chunk.type === "tool-result") {
            console.log("[AI stream chunk]", {
              requestId,
              type: chunk.type,
              toolName: chunk.toolName,
            });
            return;
          }

        },
        onStepFinish: (stepResult) => {
          if (!debugStream) return;

          console.log("[AI step finish]", {
            requestId,
            finishReason: stepResult.finishReason,
            toolCalls: stepResult.toolCalls.map((call) => call.toolName),
            toolResults: stepResult.toolResults.map((result) => result.toolName),
            textPreview: previewText(stepResult.text),
            usage: stepResult.usage,
          });
        },
        onFinish: ({ finishReason, totalUsage, steps }) => {
          const toolCallCount = steps.reduce((count, stepResult) => {
            const stepToolCalls = Array.isArray(stepResult.toolCalls) ? stepResult.toolCalls.length : 0;
            return count + stepToolCalls;
          }, 0);
          const completionChars = steps.reduce((count, stepResult) => {
            return count + (stepResult.text?.length ?? 0);
          }, 0);

          settleStreamSummary({
            finishReason,
            toolCallCount,
            completionChars,
            stepCount: steps.length,
            usageFromOnFinish: totalUsage,
          });

          if (!debugStream) return;

          console.log("[AI stream finish]", {
            requestId,
            finishReason,
            stepCount: steps.length,
            totalUsage,
          });
        },
        onError: ({ error: streamError }) => {
          settleStreamSummary({
            finishReason: "error",
            toolCallCount: 0,
            completionChars: 0,
            stepCount: 0,
            usageFromOnFinish: null,
          });

          if (!debugStream) return;
          console.error("[AI stream error]", { requestId, error: streamError });
        },
      });

      const usagePromise = Promise.resolve(result.usage).then(
        (usage) => usage,
        (error: unknown) => {
          if (debugStream) {
            console.warn("[AI usage promise failed]", { requestId, error });
          }
          return null;
        },
      );

      void Promise.all([
        usagePromise,
        streamSummaryPromise,
      ]).then(([usageFromPromise, streamSummary]) => {
        const usageFromStream = extractTokenUsage(streamSummary.usageFromOnFinish);
        const usageFromResultPromise = extractTokenUsage(usageFromPromise);
        const usage = usageFromResultPromise.totalTokens !== null
          ? usageFromResultPromise
          : usageFromStream;

        void trackAiUsageSafely({
          team_id: ctx.team.id,
          user_id: ctx.session.user.id,
          site_id: defaultToolSiteId,
          request_id: requestId,
          request_type: "chat",
          provider: aiConfig.baseURL,
          model: aiConfig.model,
          status: streamSummary.finishReason === "error" ? "error" : "success",
          error_code: streamSummary.finishReason === "error" ? "stream_finish_error" : null,
          input_tokens: usage.inputTokens,
          output_tokens: usage.outputTokens,
          total_tokens: usage.totalTokens,
          tool_calls: streamSummary.toolCallCount,
          message_count: messages.length,
          prompt_chars: promptCharsEstimate,
          completion_chars: streamSummary.completionChars,
          duration_ms: Date.now() - aiRequestStartedAt,
        });
      });

      return result.toUIMessageStreamResponse({
        headers: {
          "x-request-id": requestId,
          "Cache-Control": "no-cache, no-transform",
          "Content-Encoding": "identity",
        },
      });
    } catch (error) {
      await trackAiUsageSafely({
        team_id: ctx.team.id,
        user_id: ctx.session.user.id,
        site_id: defaultToolSiteId,
        request_id: requestId,
        request_type: "chat",
        provider: aiConfig.baseURL,
        model: aiConfig.model,
        status: "error",
        error_code: "chat_request_failed",
        error_message: truncateUtf8(error instanceof Error ? error.message : "Unknown AI chat error", 500),
        message_count: messages.length,
        prompt_chars: promptCharsEstimate,
        duration_ms: Date.now() - aiRequestStartedAt,
      });
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
