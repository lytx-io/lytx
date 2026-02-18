import { SwaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { Context } from "hono";
import { html, raw } from "hono/html";
import type { SiteDurableObject } from "../db/durable/siteDurableObject";

type Bindings = {
  STORAGE: DurableObjectNamespace<SiteDurableObject>;
  lytx_core_db: D1Database;
  ENVIRONMENT?: string;
};

type ApiKeyPermissions = {
  read?: boolean;
  write?: boolean;
};

type ApiKeyRecord = {
  key: string;
  team_id: number;
  site_id: number | null;
  enabled: number | boolean | null;
  permissions: ApiKeyPermissions | string | null;
};

type SiteRow = {
  site_id: number;
  uuid: string;
  name: string | null;
  team_id: number;
};

type AppEnv = {
  Bindings: Bindings;
  Variables: {
    apiKey: ApiKeyRecord;
    permissions: ApiKeyPermissions;
  };
};

const app = new OpenAPIHono<AppEnv>();
let apiKeyHasSiteIdColumnCache: boolean | null = null;

const MAX_SITE_LIST_LIMIT = 50;
const MAX_SQL_LIMIT = 500;
const MAX_QUERY_LIMIT = 500;
const DEFAULT_QUERY_LIMIT = 100;
const DEFAULT_WINDOW_SECONDS = 300;

const validDateStringSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !Number.isNaN(new Date(value).getTime()), {
    message: "Must be a valid date string",
  });

const siteSelectorSchema = z.object({
  site_id: z.coerce.number().int().positive().optional(),
  site_uuid: z.string().trim().min(1).optional(),
});

const siteListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_SITE_LIST_LIMIT).default(10),
});

const readQuerySchema = siteSelectorSchema.extend({
  windowSeconds: z.coerce.number().int().min(1).max(86400).default(DEFAULT_WINDOW_SECONDS),
});

const dateRangeSchema = z
  .object({
    startDate: validDateStringSchema.optional(),
    endDate: validDateStringSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.startDate || !value.endDate) return;
    const start = new Date(value.startDate);
    const end = new Date(value.endDate);
    if (end < start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "endDate must be equal to or later than startDate",
      });
    }
  });

const eventsQuerySchema = siteSelectorSchema.merge(dateRangeSchema).extend({
  eventType: z.string().trim().min(1).max(255).optional(),
  country: z.string().trim().min(1).max(120).optional(),
  deviceType: z.string().trim().min(1).max(120).optional(),
  referer: z.string().trim().min(1).max(512).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_QUERY_LIMIT).default(DEFAULT_QUERY_LIMIT),
  offset: z.coerce.number().int().min(0).default(0),
});

const statsQuerySchema = siteSelectorSchema.merge(dateRangeSchema);

const summaryQuerySchema = siteSelectorSchema.merge(dateRangeSchema).extend({
  search: z.string().trim().min(1).max(255).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_QUERY_LIMIT).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const timeSeriesQuerySchema = siteSelectorSchema.merge(dateRangeSchema).extend({
  granularity: z.enum(["hour", "day", "week", "month"]).default("day"),
  byEvent: z
    .enum(["true", "false", "1", "0"])
    .transform((value) => value === "true" || value === "1")
    .optional(),
});

const metricsQuerySchema = siteSelectorSchema.merge(dateRangeSchema).extend({
  metricType: z.enum(["events", "countries", "devices", "referers", "pages"]),
  limit: z.coerce.number().int().min(1).max(MAX_QUERY_LIMIT).default(10),
});

const sqlQueryBodySchema = siteSelectorSchema.extend({
  query: z.string().trim().min(1),
  limit: z.coerce.number().int().min(1).max(MAX_SQL_LIMIT).optional(),
});

const ErrorSchema = z.object({
  error: z.string(),
  details: z.unknown().optional(),
});

const apiSecurity: Array<Record<string, string[]>> = [
  { ApiKeyHeader: [] },
  { BearerAuth: [] },
];

function extractApiKey(request: Request, allowQueryParam: boolean): string | null {
  const xApiKey = request.headers.get("x-api-key")?.trim();
  if (xApiKey) return xApiKey;

  const auth = request.headers.get("authorization")?.trim() ?? "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim();
    if (token) return token;
  }

  if (allowQueryParam) {
    const url = new URL(request.url);
    const queryToken = url.searchParams.get("api_key")?.trim();
    if (queryToken) return queryToken;
  }

  return null;
}

function normalizePermissions(raw: ApiKeyRecord["permissions"]): ApiKeyPermissions {
  if (!raw) return { read: true, write: true };
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as ApiKeyPermissions;
      return { read: parsed.read !== false, write: parsed.write !== false };
    } catch {
      return { read: true, write: true };
    }
  }

  return {
    read: raw.read !== false,
    write: raw.write !== false,
  };
}

function dateFromInput(value?: string): Date | undefined {
  if (!value) return undefined;
  return new Date(value);
}

function jsonError(_c: Context<AppEnv>, status: number, error: string, details?: unknown) {
  const payload = details !== undefined
    ? { error, details }
    : { error };

  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function getQueryObject(c: Context<AppEnv>) {
  return Object.fromEntries(new URL(c.req.url).searchParams.entries());
}

function parseQuery<T extends z.ZodTypeAny>(
  c: Context<AppEnv>,
  schema: T,
): { data: z.infer<T>; response: null } | { data: null; response: Response } {
  const parsed = schema.safeParse(getQueryObject(c));
  if (!parsed.success) {
    return {
      data: null,
      response: jsonError(c, 400, "Invalid query parameters", parsed.error.flatten()),
    };
  }
  return { data: parsed.data, response: null };
}

async function parseJsonBody<T extends z.ZodTypeAny>(
  c: Context<AppEnv>,
  schema: T,
): Promise<{ data: z.infer<T>; response: null } | { data: null; response: Response }> {
  let rawBody: unknown;
  try {
    rawBody = await c.req.json();
  } catch {
    return {
      data: null,
      response: jsonError(c, 400, "Invalid JSON body"),
    };
  }

  const parsed = schema.safeParse(rawBody);
  if (!parsed.success) {
    return {
      data: null,
      response: jsonError(c, 400, "Invalid request body", parsed.error.flatten()),
    };
  }
  return { data: parsed.data, response: null };
}

async function hasApiKeySiteIdColumn(db: D1Database): Promise<boolean> {
  if (apiKeyHasSiteIdColumnCache !== null) {
    return apiKeyHasSiteIdColumnCache;
  }

  try {
    const columns = await db
      .prepare("PRAGMA table_info(api_key)")
      .all<{ name: string }>();
    apiKeyHasSiteIdColumnCache = columns.results.some(
      (column) => column.name === "site_id",
    );
  } catch {
    apiKeyHasSiteIdColumnCache = false;
  }

  return apiKeyHasSiteIdColumnCache;
}

async function loadApiKeyRecord(
  db: D1Database,
  providedKey: string,
): Promise<ApiKeyRecord | null> {
  const hasSiteId = await hasApiKeySiteIdColumn(db);

  if (hasSiteId) {
    return db
      .prepare(
        "SELECT key, team_id, site_id, enabled, permissions FROM api_key WHERE key = ?1 LIMIT 1",
      )
      .bind(providedKey)
      .first<ApiKeyRecord>();
  }

  const legacyRecord = await db
    .prepare(
      "SELECT key, team_id, enabled, permissions FROM api_key WHERE key = ?1 LIMIT 1",
    )
    .bind(providedKey)
    .first<Omit<ApiKeyRecord, "site_id">>();

  if (!legacyRecord) {
    return null;
  }

  return {
    ...legacyRecord,
    site_id: null,
  };
}

async function resolveSiteAndStub(
  c: Context<AppEnv>,
  selection: {
    site_id?: number;
    site_uuid?: string;
  },
): Promise<
  | {
    site: SiteRow;
    stub: DurableObjectStub<SiteDurableObject>;
    response: null;
  }
  | {
    site: null;
    stub: null;
    response: Response;
  }
> {
  const keyRecord = c.get("apiKey");
  const requestedSiteId = selection.site_id;
  const resolvedSiteId = requestedSiteId ?? keyRecord.site_id ?? undefined;

  if (!resolvedSiteId) {
    return {
      site: null,
      stub: null,
      response: jsonError(
        c,
        400,
        "site_id is required unless this API key is restricted to a single site",
      ),
    };
  }

  if (keyRecord.site_id !== null && keyRecord.site_id !== resolvedSiteId) {
    return {
      site: null,
      stub: null,
      response: jsonError(c, 403, `API key is limited to site_id=${keyRecord.site_id}`),
    };
  }

  const row = selection.site_uuid
    ? await c.env.lytx_core_db
      .prepare(
        "SELECT site_id, uuid, name, team_id FROM sites WHERE site_id = ?1 AND uuid = ?2 LIMIT 1",
      )
      .bind(resolvedSiteId, selection.site_uuid)
      .first<SiteRow>()
    : await c.env.lytx_core_db
      .prepare(
        "SELECT site_id, uuid, name, team_id FROM sites WHERE site_id = ?1 LIMIT 1",
      )
      .bind(resolvedSiteId)
      .first<SiteRow>();

  if (!row?.uuid) {
    return {
      site: null,
      stub: null,
      response: jsonError(
        c,
        404,
        selection.site_uuid
          ? `No site found for site_id=${resolvedSiteId} and provided site_uuid`
          : `No site found for site_id=${resolvedSiteId}`,
      ),
    };
  }

  if (row.team_id !== keyRecord.team_id) {
    return {
      site: null,
      stub: null,
      response: jsonError(
        c,
        403,
        `site_id=${resolvedSiteId} does not belong to this API key's team`,
      ),
    };
  }

  const doId = c.env.STORAGE.idFromName(row.uuid);
  const stub = c.env.STORAGE.get(doId);
  await stub.setSiteInfo(row.site_id, row.uuid);

  return {
    site: row,
    stub,
    response: null,
  };
}

app.doc31("/openapi.json", () => ({
  openapi: "3.1.0",
  info: {
    title: "Lytx Site Data API",
    version: "1.0.0",
    description:
      "API-key protected access to site durable object data. Supports read-only SQL and structured analytics queries with date ranges.",
  },
  components: {
    securitySchemes: {
      ApiKeyHeader: {
        type: "apiKey",
        in: "header",
        name: "x-api-key",
        description: "Primary API key header.",
      },
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "API key",
        description: "Bearer token alternative to x-api-key.",
      },
    },
  },
  security: apiSecurity,
}));

function lytxSwaggerPage(c: Context<AppEnv>) {
  const swaggerHtml = SwaggerUI({
    url: "/openapi.json",
    persistAuthorization: true,
    deepLinking: true,
    manuallySwaggerUIHtml: (asset) => `
      <div id="swagger-ui"></div>
      ${asset.css.map((url) => `<link rel="stylesheet" href="${url}" />`).join("\n")}
      ${asset.js.map((url) => `<script src="${url}" crossorigin="anonymous"><\/script>`).join("\n")}
      <script>
        window.onload = () => {
          window.ui = SwaggerUIBundle({
            dom_id: '#swagger-ui',
            url: '/openapi.json',
            persistAuthorization: true,
            deepLinking: true,
            defaultModelsExpandDepth: 1,
            docExpansion: 'list',
            syntaxHighlight: { activated: true, theme: 'monokai' },
            filter: true,
          })
        }
      <\/script>
    `,
  });

  return c.html(html`<!doctype html>
<html lang="en" data-theme="dark">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="Lytx Site Data API Documentation" />
    <title>Lytx API Docs</title>
    <link rel="icon" href="/favicon.ico" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Montserrat:wght@600;700&display=swap" rel="stylesheet" />
    <style>
      /* ── Lytx Theme Variables ── */
      :root {
        --lytx-bg-primary: #121212;
        --lytx-bg-secondary: #171717;
        --lytx-bg-tertiary: #222222;
        --lytx-text-primary: #f8fafc;
        --lytx-text-secondary: #cbd5e1;
        --lytx-text-tertiary: #94a3b8;
        --lytx-border-primary: #1f2937;
        --lytx-border-secondary: #f59e0b;
        --lytx-card-bg: #171717;
        --lytx-card-border: #1f2937;
        --lytx-input-bg: #141414;
        --lytx-input-border: #334155;
        --lytx-button-bg: #f97316;
        --lytx-button-hover: #ea580c;
        --lytx-color-primary: #f97316;
        --lytx-color-accent: #f59e0b;
        --lytx-color-danger: #ef4444;
        --lytx-color-success: #22c55e;
        --lytx-color-info: #3b82f6;
      }

      html[data-theme="light"] {
        --lytx-bg-primary: #ffffff;
        --lytx-bg-secondary: #f9fafb;
        --lytx-bg-tertiary: #f3f4f6;
        --lytx-text-primary: #111827;
        --lytx-text-secondary: #4b5563;
        --lytx-text-tertiary: #6b7280;
        --lytx-border-primary: #e5e7eb;
        --lytx-border-secondary: #d1d5db;
        --lytx-card-bg: #ffffff;
        --lytx-card-border: #e5e7eb;
        --lytx-input-bg: #ffffff;
        --lytx-input-border: #d1d5db;
      }

      /* ── Base Reset ── */
      *, *::before, *::after { box-sizing: border-box; }

      body {
        margin: 0;
        padding: 0;
        background: var(--lytx-bg-primary);
        color: var(--lytx-text-primary);
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }

      /* ── Custom Top Bar ── */
      .lytx-topbar {
        position: sticky;
        top: 0;
        z-index: 100;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 24px;
        background: var(--lytx-bg-secondary);
        border-bottom: 1px solid var(--lytx-border-primary);
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
      }

      .lytx-topbar-left {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .lytx-logo {
        width: 28px;
        height: 28px;
        border-radius: 6px;
      }

      .lytx-title {
        font-family: 'Montserrat', 'Inter', system-ui, sans-serif;
        font-size: 20px;
        font-weight: 700;
        color: var(--lytx-text-primary);
        text-decoration: none;
      }

      .lytx-title:hover {
        color: var(--lytx-color-primary);
        transition: color 0.15s ease;
      }

      .lytx-badge {
        display: inline-flex;
        align-items: center;
        padding: 3px 10px;
        border-radius: 9999px;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        background: rgba(249, 115, 22, 0.12);
        color: var(--lytx-color-primary);
        border: 1px solid rgba(249, 115, 22, 0.25);
      }

      .lytx-topbar-right {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .lytx-theme-toggle {
        background: transparent;
        border: 1px solid var(--lytx-border-primary);
        border-radius: 8px;
        padding: 6px 10px;
        cursor: pointer;
        color: var(--lytx-text-secondary);
        font-size: 16px;
        transition: all 0.15s ease;
      }

      .lytx-theme-toggle:hover {
        background: var(--lytx-bg-tertiary);
        color: var(--lytx-text-primary);
        border-color: var(--lytx-text-tertiary);
      }

      .lytx-link-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 7px 16px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 500;
        text-decoration: none;
        transition: all 0.15s ease;
        background: var(--lytx-color-primary);
        color: #fff;
        border: none;
      }

      .lytx-link-btn:hover {
        background: var(--lytx-button-hover);
      }

      .lytx-link-btn.outline {
        background: transparent;
        color: var(--lytx-text-secondary);
        border: 1px solid var(--lytx-border-primary);
      }

      .lytx-link-btn.outline:hover {
        background: var(--lytx-bg-tertiary);
        color: var(--lytx-text-primary);
      }

      /* ── Swagger UI Container ── */
      .swagger-wrapper {
        max-width: 1400px;
        margin: 0 auto;
        padding: 16px 24px 48px;
      }

      /* ── Override Swagger UI default theme ── */

      /* Hide default topbar */
      .swagger-ui .topbar { display: none !important; }

      /* Base wrapper */
      .swagger-ui { color: var(--lytx-text-primary); }
      .swagger-ui .wrapper { padding: 0; max-width: none; }

      /* Info section */
      .swagger-ui .info {
        margin: 24px 0 16px;
        padding: 24px;
        background: var(--lytx-card-bg);
        border: 1px solid var(--lytx-card-border);
        border-radius: 12px;
      }

      .swagger-ui .info hgroup.main {
        margin: 0;
      }

      .swagger-ui .info .title {
        font-family: 'Montserrat', 'Inter', system-ui, sans-serif;
        color: var(--lytx-text-primary);
        font-size: 28px;
        font-weight: 700;
      }

      .swagger-ui .info .title small { display: none; }

      .swagger-ui .info .title small.version-stamp {
        display: inline-flex;
        background: rgba(249, 115, 22, 0.12);
        color: var(--lytx-color-primary);
        border: 1px solid rgba(249, 115, 22, 0.25);
        border-radius: 9999px;
        padding: 2px 10px;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.05em;
        vertical-align: middle;
        margin-left: 8px;
        position: relative;
        top: -2px;
      }

      .swagger-ui .info .description,
      .swagger-ui .info .description p {
        color: var(--lytx-text-secondary);
        font-size: 14px;
        line-height: 1.6;
      }

      .swagger-ui .info a {
        color: var(--lytx-color-primary);
      }

      .swagger-ui .info a:hover {
        color: var(--lytx-button-hover);
      }

      /* Filter input */
      .swagger-ui .filter-container {
        margin: 0 0 8px;
        padding: 0;
      }

      .swagger-ui .filter-container .operation-filter-input {
        background: var(--lytx-input-bg);
        border: 1px solid var(--lytx-input-border);
        border-radius: 8px;
        color: var(--lytx-text-primary);
        padding: 10px 16px;
        font-size: 14px;
        margin: 0;
      }

      .swagger-ui .filter-container .operation-filter-input:focus {
        outline: none;
        border-color: var(--lytx-color-primary);
        box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.15);
      }

      .swagger-ui .filter-container .operation-filter-input::placeholder {
        color: var(--lytx-text-tertiary);
      }

      /* Scheme container */
      .swagger-ui .scheme-container {
        background: var(--lytx-card-bg);
        border: 1px solid var(--lytx-card-border);
        border-radius: 12px;
        padding: 16px 20px;
        margin: 0 0 16px;
        box-shadow: none;
      }

      /* Authorize button */
      .swagger-ui .btn.authorize {
        background: transparent;
        color: var(--lytx-color-primary);
        border: 1px solid var(--lytx-color-primary);
        border-radius: 8px;
        font-weight: 600;
        font-size: 13px;
        padding: 8px 20px;
        transition: all 0.15s ease;
      }

      .swagger-ui .btn.authorize:hover {
        background: rgba(249, 115, 22, 0.1);
      }

      .swagger-ui .btn.authorize svg {
        fill: var(--lytx-color-primary);
      }

      /* Tag groups (sections) */
      .swagger-ui .opblock-tag-section {
        margin-bottom: 8px;
      }

      .swagger-ui .opblock-tag {
        font-family: 'Montserrat', 'Inter', system-ui, sans-serif;
        color: var(--lytx-text-primary);
        font-size: 18px;
        font-weight: 600;
        border-bottom: 1px solid var(--lytx-border-primary);
        padding: 14px 0;
        margin: 0;
      }

      .swagger-ui .opblock-tag:hover {
        background: transparent;
      }

      .swagger-ui .opblock-tag small {
        color: var(--lytx-text-tertiary);
        font-family: 'Inter', system-ui, sans-serif;
        font-size: 13px;
        font-weight: 400;
      }

      .swagger-ui .opblock-tag svg { fill: var(--lytx-text-tertiary); }

      /* Operation blocks */
      .swagger-ui .opblock {
        border-radius: 10px;
        border: 1px solid var(--lytx-card-border);
        margin: 8px 0;
        box-shadow: none;
        overflow: hidden;
      }

      /* GET */
      .swagger-ui .opblock.opblock-get {
        background: rgba(59, 130, 246, 0.04);
        border-color: rgba(59, 130, 246, 0.25);
      }
      .swagger-ui .opblock.opblock-get .opblock-summary-method {
        background: #3b82f6;
        border-radius: 6px;
        font-weight: 700;
        font-size: 12px;
        min-width: 60px;
        text-align: center;
        padding: 6px 12px;
      }
      .swagger-ui .opblock.opblock-get .opblock-summary {
        border-color: rgba(59, 130, 246, 0.15);
      }

      /* POST */
      .swagger-ui .opblock.opblock-post {
        background: rgba(34, 197, 94, 0.04);
        border-color: rgba(34, 197, 94, 0.25);
      }
      .swagger-ui .opblock.opblock-post .opblock-summary-method {
        background: #22c55e;
        border-radius: 6px;
        font-weight: 700;
        font-size: 12px;
        min-width: 60px;
        text-align: center;
        padding: 6px 12px;
      }
      .swagger-ui .opblock.opblock-post .opblock-summary {
        border-color: rgba(34, 197, 94, 0.15);
      }

      /* PUT */
      .swagger-ui .opblock.opblock-put {
        background: rgba(249, 115, 22, 0.04);
        border-color: rgba(249, 115, 22, 0.25);
      }
      .swagger-ui .opblock.opblock-put .opblock-summary-method {
        background: var(--lytx-color-primary);
        border-radius: 6px;
        font-weight: 700;
        font-size: 12px;
        min-width: 60px;
        text-align: center;
        padding: 6px 12px;
      }
      .swagger-ui .opblock.opblock-put .opblock-summary {
        border-color: rgba(249, 115, 22, 0.15);
      }

      /* DELETE */
      .swagger-ui .opblock.opblock-delete {
        background: rgba(239, 68, 68, 0.04);
        border-color: rgba(239, 68, 68, 0.25);
      }
      .swagger-ui .opblock.opblock-delete .opblock-summary-method {
        background: var(--lytx-color-danger);
        border-radius: 6px;
        font-weight: 700;
        font-size: 12px;
        min-width: 60px;
        text-align: center;
        padding: 6px 12px;
      }
      .swagger-ui .opblock.opblock-delete .opblock-summary {
        border-color: rgba(239, 68, 68, 0.15);
      }

      /* Operation summary row */
      .swagger-ui .opblock .opblock-summary {
        padding: 8px 16px;
      }

      .swagger-ui .opblock .opblock-summary-path {
        color: var(--lytx-text-primary);
        font-size: 14px;
        font-weight: 500;
        font-family: 'Inter', ui-monospace, SFMono-Regular, Menlo, monospace;
      }

      .swagger-ui .opblock .opblock-summary-path__deprecated {
        color: var(--lytx-text-tertiary);
        text-decoration: line-through;
      }

      .swagger-ui .opblock .opblock-summary-description {
        color: var(--lytx-text-secondary);
        font-size: 13px;
      }

      /* Operation body (expanded) */
      .swagger-ui .opblock-body {
        background: var(--lytx-card-bg);
      }

      .swagger-ui .opblock-body pre,
      .swagger-ui .opblock-body pre.microlight {
        background: var(--lytx-bg-primary) !important;
        border: 1px solid var(--lytx-border-primary);
        border-radius: 8px;
        color: var(--lytx-text-primary);
        padding: 16px;
        font-size: 13px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      }

      .swagger-ui .opblock-description-wrapper,
      .swagger-ui .opblock-external-docs-wrapper {
        color: var(--lytx-text-secondary);
        padding: 16px 20px;
      }

      .swagger-ui .opblock-description-wrapper p,
      .swagger-ui .opblock-external-docs-wrapper p {
        color: var(--lytx-text-secondary);
      }

      /* Parameters table */
      .swagger-ui table thead tr th,
      .swagger-ui table thead tr td {
        color: var(--lytx-text-secondary);
        border-bottom: 1px solid var(--lytx-border-primary);
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        padding: 10px 12px;
      }

      .swagger-ui table tbody tr td {
        color: var(--lytx-text-primary);
        border-bottom: 1px solid var(--lytx-border-primary);
        padding: 10px 12px;
        font-size: 13px;
      }

      .swagger-ui .parameters-col_description p {
        color: var(--lytx-text-secondary);
        font-size: 13px;
        margin: 0;
      }

      .swagger-ui .parameter__name {
        color: var(--lytx-text-primary);
        font-weight: 600;
        font-size: 13px;
      }

      .swagger-ui .parameter__name.required::after {
        color: var(--lytx-color-danger);
      }

      .swagger-ui .parameter__type {
        color: var(--lytx-text-tertiary);
        font-size: 12px;
      }

      .swagger-ui .parameter__in {
        color: var(--lytx-text-tertiary);
        font-size: 11px;
      }

      /* Input fields within swagger */
      .swagger-ui input[type=text],
      .swagger-ui input[type=password],
      .swagger-ui input[type=search],
      .swagger-ui input[type=email],
      .swagger-ui input[type=file],
      .swagger-ui textarea,
      .swagger-ui select {
        background: var(--lytx-input-bg);
        border: 1px solid var(--lytx-input-border);
        border-radius: 6px;
        color: var(--lytx-text-primary);
        padding: 8px 12px;
        font-size: 13px;
        font-family: 'Inter', system-ui, sans-serif;
      }

      .swagger-ui input[type=text]:focus,
      .swagger-ui input[type=password]:focus,
      .swagger-ui textarea:focus,
      .swagger-ui select:focus {
        outline: none;
        border-color: var(--lytx-color-primary);
        box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.15);
      }

      .swagger-ui select {
        appearance: auto;
      }

      /* Buttons */
      .swagger-ui .btn {
        border-radius: 6px;
        font-weight: 600;
        font-size: 13px;
        transition: all 0.15s ease;
        box-shadow: none;
      }

      .swagger-ui .btn.execute {
        background: var(--lytx-color-primary);
        color: #fff;
        border: none;
        border-radius: 8px;
        padding: 8px 24px;
        font-weight: 600;
      }

      .swagger-ui .btn.execute:hover {
        background: var(--lytx-button-hover);
      }

      .swagger-ui .btn.cancel {
        color: var(--lytx-text-secondary);
        border-color: var(--lytx-border-primary);
      }

      .swagger-ui .btn-group .btn {
        border-radius: 6px;
      }

      /* Response section */
      .swagger-ui .responses-wrapper {
        padding: 0 20px 20px;
      }

      .swagger-ui .responses-inner {
        padding: 0;
      }

      .swagger-ui .responses-inner h4,
      .swagger-ui .responses-inner h5,
      .swagger-ui .response-col_status {
        color: var(--lytx-text-primary);
        font-weight: 600;
      }

      .swagger-ui .response-col_description {
        color: var(--lytx-text-secondary);
      }

      .swagger-ui .response-col_links {
        color: var(--lytx-text-tertiary);
      }

      .swagger-ui .responses-table {
        padding: 0;
      }

      /* Tab headers in response */
      .swagger-ui .tab li {
        color: var(--lytx-text-secondary);
        font-size: 13px;
      }

      .swagger-ui .tab li.active {
        color: var(--lytx-text-primary);
      }

      .swagger-ui .tab li button.tablinks {
        color: inherit;
        background: transparent;
      }

      /* Models section */
      .swagger-ui section.models {
        border: 1px solid var(--lytx-card-border);
        border-radius: 12px;
        background: var(--lytx-card-bg);
        overflow: hidden;
      }

      .swagger-ui section.models h4 {
        color: var(--lytx-text-primary);
        font-family: 'Montserrat', 'Inter', system-ui, sans-serif;
        font-weight: 600;
        font-size: 16px;
        margin: 0;
        padding: 16px 20px;
        border-bottom: 1px solid var(--lytx-border-primary);
      }

      .swagger-ui section.models .model-container {
        background: transparent;
        margin: 4px 0;
        border-radius: 0;
      }

      .swagger-ui .model-box {
        background: transparent;
      }

      .swagger-ui .model {
        color: var(--lytx-text-primary);
        font-size: 13px;
      }

      .swagger-ui .model .property {
        color: var(--lytx-text-primary);
      }

      .swagger-ui .model .property.primitive {
        color: var(--lytx-text-secondary);
      }

      .swagger-ui .model-title {
        color: var(--lytx-text-primary);
        font-weight: 600;
      }

      .swagger-ui span.model-title__text {
        color: var(--lytx-text-primary);
        font-weight: 600;
      }

      /* Loading */
      .swagger-ui .loading-container .loading::after {
        color: var(--lytx-text-secondary);
      }

      /* Auth Modal */
      .swagger-ui .dialog-ux .modal-ux {
        background: var(--lytx-card-bg);
        border: 1px solid var(--lytx-card-border);
        border-radius: 12px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.4);
      }

      .swagger-ui .dialog-ux .modal-ux-header {
        border-bottom: 1px solid var(--lytx-border-primary);
        padding: 16px 24px;
      }

      .swagger-ui .dialog-ux .modal-ux-header h3 {
        color: var(--lytx-text-primary);
        font-family: 'Montserrat', 'Inter', system-ui, sans-serif;
        font-weight: 600;
      }

      .swagger-ui .dialog-ux .modal-ux-content {
        padding: 24px;
        color: var(--lytx-text-secondary);
      }

      .swagger-ui .dialog-ux .modal-ux-content p {
        color: var(--lytx-text-secondary);
      }

      .swagger-ui .dialog-ux .modal-ux-content label {
        color: var(--lytx-text-primary);
      }

      .swagger-ui .dialog-ux .backdrop-ux {
        background: rgba(0, 0, 0, 0.6);
      }

      .swagger-ui .auth-btn-wrapper .btn-done {
        background: var(--lytx-color-primary);
        color: #fff;
        border: none;
        border-radius: 8px;
      }

      /* Copy button */
      .swagger-ui .copy-to-clipboard { background: var(--lytx-bg-tertiary); }

      /* Servers dropdown */
      .swagger-ui .servers > label {
        color: var(--lytx-text-secondary);
      }

      .swagger-ui .servers > label select {
        background: var(--lytx-input-bg);
        border: 1px solid var(--lytx-input-border);
        color: var(--lytx-text-primary);
        border-radius: 6px;
      }

      /* Download URL (if any) */
      .swagger-ui .download-url-wrapper .download-url-button {
        background: var(--lytx-color-primary);
        color: #fff;
        border-radius: 8px;
        border: none;
      }

      /* Arrow / toggle icons */
      .swagger-ui svg:not(:root) {
        fill: var(--lytx-text-tertiary);
      }

      .swagger-ui .expand-operation svg { fill: var(--lytx-text-tertiary); }

      /* Highlighted JSON */
      .swagger-ui .highlight-code > .microlight {
        background: var(--lytx-bg-primary) !important;
        border: 1px solid var(--lytx-border-primary);
        border-radius: 8px;
        padding: 16px !important;
        font-size: 13px;
      }

      /* Response content type label */
      .swagger-ui .response-content-type.controls-accept-header select {
        background: var(--lytx-input-bg);
        border: 1px solid var(--lytx-input-border);
        color: var(--lytx-text-primary);
        border-radius: 6px;
      }

      /* Try it out button */
      .swagger-ui .try-out__btn {
        border-color: var(--lytx-color-primary);
        color: var(--lytx-color-primary);
        border-radius: 6px;
        font-weight: 600;
      }

      .swagger-ui .try-out__btn:hover {
        background: rgba(249, 115, 22, 0.08);
      }

      /* Markdown rendered within descriptions */
      .swagger-ui .markdown p,
      .swagger-ui .markdown li,
      .swagger-ui .renderedMarkdown p {
        color: var(--lytx-text-secondary);
      }

      .swagger-ui .markdown code,
      .swagger-ui .renderedMarkdown code {
        background: var(--lytx-bg-tertiary);
        color: var(--lytx-color-primary);
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 12px;
      }

      /* Override all remaining text */
      .swagger-ui,
      .swagger-ui .info .title,
      .swagger-ui .opblock .opblock-section-header h4,
      .swagger-ui .opblock .opblock-section-header label,
      .swagger-ui label,
      .swagger-ui .model-hint {
        color: var(--lytx-text-primary);
      }

      .swagger-ui .opblock .opblock-section-header {
        background: var(--lytx-bg-secondary);
        border-bottom: 1px solid var(--lytx-border-primary);
        box-shadow: none;
      }

      .swagger-ui .opblock .opblock-section-header h4 {
        color: var(--lytx-text-primary);
        font-size: 14px;
        font-weight: 600;
      }

      /* Response codes */
      .swagger-ui .responses-wrapper .response-col_status {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 13px;
        font-weight: 700;
      }

      /* Scrollbar styling for dark mode */
      .swagger-ui ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }
      .swagger-ui ::-webkit-scrollbar-track {
        background: var(--lytx-bg-secondary);
      }
      .swagger-ui ::-webkit-scrollbar-thumb {
        background: var(--lytx-bg-tertiary);
        border-radius: 4px;
      }
      .swagger-ui ::-webkit-scrollbar-thumb:hover {
        background: var(--lytx-text-tertiary);
      }

      /* Responsive adjustments */
      @media (max-width: 768px) {
        .lytx-topbar {
          padding: 10px 16px;
        }
        .lytx-title {
          font-size: 17px;
        }
        .lytx-badge {
          display: none;
        }
        .swagger-wrapper {
          padding: 12px 16px 32px;
        }
        .swagger-ui .info {
          padding: 16px;
        }
      }
    </style>
    <script>
      (function() {
        var saved = localStorage.getItem('lytx-api-docs-theme');
        if (saved === 'light') {
          document.documentElement.setAttribute('data-theme', 'light');
        }
      })();
    </script>
  </head>
  <body>
    <div class="lytx-topbar">
      <div class="lytx-topbar-left">
        <img src="/logo.png" alt="Lytx" class="lytx-logo" />
        <a href="/" class="lytx-title">Lytx</a>
        <span class="lytx-badge">API Docs</span>
      </div>
      <div class="lytx-topbar-right">
        <button class="lytx-theme-toggle" id="theme-toggle" title="Toggle theme" aria-label="Toggle light/dark theme">
          <span id="theme-icon">&#9790;</span>
        </button>
        <a href="/settings" class="lytx-link-btn outline">Dashboard</a>
        <a href="/" class="lytx-link-btn">Home</a>
      </div>
    </div>
    <div class="swagger-wrapper">
      ${raw(swaggerHtml)}
    </div>
    <script>
      (function() {
        var toggle = document.getElementById('theme-toggle');
        var icon = document.getElementById('theme-icon');
        function updateIcon() {
          var theme = document.documentElement.getAttribute('data-theme');
          icon.textContent = theme === 'light' ? '\\u2600' : '\\u263E';
        }
        updateIcon();
        toggle.addEventListener('click', function() {
          var current = document.documentElement.getAttribute('data-theme');
          var next = current === 'light' ? 'dark' : 'light';
          document.documentElement.setAttribute('data-theme', next);
          localStorage.setItem('lytx-api-docs-theme', next);
          updateIcon();
        });
      })();
    <\/script>
  </body>
</html>`);
}

app.get("/", (c) => lytxSwaggerPage(c));
app.get("/docs", (c) => lytxSwaggerPage(c));

const healthRoute = createRoute({
  method: "get",
  path: "/health",
  tags: ["System"],
  responses: {
    200: {
      description: "Worker health check",
      content: {
        "application/json": {
          schema: z.object({ ok: z.boolean() }),
        },
      },
    },
  },
});

app.openapi(healthRoute, (c) => c.json({ ok: true }, 200));

app.use("/do/*", async (c, next) => {
  const isDevelopment =
    c.env.ENVIRONMENT === "development" || c.env.ENVIRONMENT === "dev";
  const providedKey = extractApiKey(c.req.raw, isDevelopment);

  if (!providedKey) {
    return c.json(
      {
        error: isDevelopment
          ? "Missing API key. Use x-api-key header or ?api_key=... in development."
          : "Missing API key",
      },
      401,
    );
  }

  const keyRecord = await loadApiKeyRecord(c.env.lytx_core_db, providedKey);

  if (!keyRecord) {
    return c.json({ error: "Invalid API key" }, 401);
  }

  if (keyRecord.enabled === 0 || keyRecord.enabled === false) {
    return c.json({ error: "API key disabled" }, 403);
  }

  const permissions = normalizePermissions(keyRecord.permissions);
  if (!permissions.read) {
    return c.json({ error: "API key lacks read permission" }, 403);
  }

  c.set("apiKey", keyRecord);
  c.set("permissions", permissions);
  await next();
});

const listSitesRoute = createRoute({
  method: "get",
  path: "/do/sites",
  tags: ["Sites"],
  security: apiSecurity,
  request: {
    query: siteListQuerySchema,
  },
  responses: {
    200: { description: "Accessible sites" },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

app.openapi(listSitesRoute, async (c) => {
  const parsed = parseQuery(c, siteListQuerySchema);
  if (parsed.response) return parsed.response;

  const query = parsed.data;
  const keyRecord = c.get("apiKey");

  const rows = keyRecord.site_id !== null
    ? await c.env.lytx_core_db
      .prepare(
        "SELECT site_id, uuid, name FROM sites WHERE team_id = ?1 AND site_id = ?2 ORDER BY site_id DESC LIMIT ?3",
      )
      .bind(keyRecord.team_id, keyRecord.site_id, query.limit)
      .all<{ site_id: number; uuid: string; name: string | null }>()
    : await c.env.lytx_core_db
      .prepare(
        "SELECT site_id, uuid, name FROM sites WHERE team_id = ?1 ORDER BY site_id DESC LIMIT ?2",
      )
      .bind(keyRecord.team_id, query.limit)
      .all<{ site_id: number; uuid: string; name: string | null }>();

  return c.json(
    {
      count: rows.results.length,
      sites: rows.results,
    },
    200,
  );
});

const readRoute = createRoute({
  method: "get",
  path: "/do/read",
  tags: ["Sites"],
  security: apiSecurity,
  request: {
    query: readQuerySchema,
  },
  responses: {
    200: { description: "Site health and current visitors" },
    400: { description: "Bad request", content: { "application/json": { schema: ErrorSchema } } },
    403: { description: "Forbidden", content: { "application/json": { schema: ErrorSchema } } },
    404: { description: "Not found", content: { "application/json": { schema: ErrorSchema } } },
    500: { description: "Server error", content: { "application/json": { schema: ErrorSchema } } },
  },
});

app.openapi(readRoute, async (c) => {
  const parsed = parseQuery(c, readQuerySchema);
  if (parsed.response) return parsed.response;

  const query = parsed.data;
  const siteAndStub = await resolveSiteAndStub(c, query);
  if (siteAndStub.response) return siteAndStub.response;

  try {
    const [health, currentVisitors] = await Promise.all([
      siteAndStub.stub.healthCheck(),
      siteAndStub.stub.getCurrentVisitors({ windowSeconds: query.windowSeconds }),
    ]);

    return c.json(
      {
        site: {
          site_id: siteAndStub.site.site_id,
          site_uuid: siteAndStub.site.uuid,
          name: siteAndStub.site.name,
        },
        health,
        currentVisitors,
      },
      200,
    );
  } catch (error) {
    return jsonError(
      c,
      500,
      error instanceof Error ? error.message : "Unknown durable object error",
    );
  }
});

const schemaRoute = createRoute({
  method: "get",
  path: "/do/schema",
  tags: ["Schema"],
  security: apiSecurity,
  request: {
    query: siteSelectorSchema,
  },
  responses: {
    200: { description: "Runtime schema metadata" },
    400: { description: "Bad request", content: { "application/json": { schema: ErrorSchema } } },
    403: { description: "Forbidden", content: { "application/json": { schema: ErrorSchema } } },
    404: { description: "Not found", content: { "application/json": { schema: ErrorSchema } } },
    500: { description: "Server error", content: { "application/json": { schema: ErrorSchema } } },
  },
});

app.openapi(schemaRoute, async (c) => {
  const parsed = parseQuery(c, siteSelectorSchema);
  if (parsed.response) return parsed.response;

  const query = parsed.data;
  const siteAndStub = await resolveSiteAndStub(c, query);
  if (siteAndStub.response) return siteAndStub.response;

  try {
    const schemaResult = await siteAndStub.stub.getSchema();
    if (!schemaResult.success) {
      return jsonError(c, 500, schemaResult.error ?? "Failed to get schema");
    }

    return c.json(
      {
        site: {
          site_id: siteAndStub.site.site_id,
          site_uuid: siteAndStub.site.uuid,
          name: siteAndStub.site.name,
        },
        tables: schemaResult.tables,
      },
      200,
    );
  } catch (error) {
    return jsonError(
      c,
      500,
      error instanceof Error ? error.message : "Unknown durable object error",
    );
  }
});

const eventsRoute = createRoute({
  method: "get",
  path: "/do/events",
  tags: ["Events"],
  security: apiSecurity,
  request: {
    query: eventsQuerySchema,
  },
  responses: {
    200: { description: "Filtered events" },
    400: { description: "Bad request", content: { "application/json": { schema: ErrorSchema } } },
    403: { description: "Forbidden", content: { "application/json": { schema: ErrorSchema } } },
    404: { description: "Not found", content: { "application/json": { schema: ErrorSchema } } },
    500: { description: "Server error", content: { "application/json": { schema: ErrorSchema } } },
  },
});

app.openapi(eventsRoute, async (c) => {
  const parsed = parseQuery(c, eventsQuerySchema);
  if (parsed.response) return parsed.response;

  const query = parsed.data;
  const siteAndStub = await resolveSiteAndStub(c, query);
  if (siteAndStub.response) return siteAndStub.response;

  try {
    const result = await siteAndStub.stub.getEventsData({
      startDate: dateFromInput(query.startDate),
      endDate: dateFromInput(query.endDate),
      eventType: query.eventType,
      country: query.country,
      deviceType: query.deviceType,
      referer: query.referer,
      limit: query.limit,
      offset: query.offset,
    });

    return c.json(
      {
        site: {
          site_id: siteAndStub.site.site_id,
          site_uuid: siteAndStub.site.uuid,
          name: siteAndStub.site.name,
        },
        query: result,
      },
      200,
    );
  } catch (error) {
    return jsonError(
      c,
      500,
      error instanceof Error ? error.message : "Unknown durable object error",
    );
  }
});

const statsRoute = createRoute({
  method: "get",
  path: "/do/stats",
  tags: ["Analytics"],
  security: apiSecurity,
  request: {
    query: statsQuerySchema,
  },
  responses: {
    200: { description: "Aggregated stats" },
    400: { description: "Bad request", content: { "application/json": { schema: ErrorSchema } } },
    403: { description: "Forbidden", content: { "application/json": { schema: ErrorSchema } } },
    404: { description: "Not found", content: { "application/json": { schema: ErrorSchema } } },
    500: { description: "Server error", content: { "application/json": { schema: ErrorSchema } } },
  },
});

app.openapi(statsRoute, async (c) => {
  const parsed = parseQuery(c, statsQuerySchema);
  if (parsed.response) return parsed.response;

  const query = parsed.data;
  const siteAndStub = await resolveSiteAndStub(c, query);
  if (siteAndStub.response) return siteAndStub.response;

  try {
    const stats = await siteAndStub.stub.getStats({
      startDate: dateFromInput(query.startDate),
      endDate: dateFromInput(query.endDate),
    });

    return c.json(
      {
        site: {
          site_id: siteAndStub.site.site_id,
          site_uuid: siteAndStub.site.uuid,
          name: siteAndStub.site.name,
        },
        stats,
      },
      200,
    );
  } catch (error) {
    return jsonError(
      c,
      500,
      error instanceof Error ? error.message : "Unknown durable object error",
    );
  }
});

const summaryRoute = createRoute({
  method: "get",
  path: "/do/event-summary",
  tags: ["Analytics"],
  security: apiSecurity,
  request: {
    query: summaryQuerySchema,
  },
  responses: {
    200: { description: "Event summary" },
    400: { description: "Bad request", content: { "application/json": { schema: ErrorSchema } } },
    403: { description: "Forbidden", content: { "application/json": { schema: ErrorSchema } } },
    404: { description: "Not found", content: { "application/json": { schema: ErrorSchema } } },
    500: { description: "Server error", content: { "application/json": { schema: ErrorSchema } } },
  },
});

app.openapi(summaryRoute, async (c) => {
  const parsed = parseQuery(c, summaryQuerySchema);
  if (parsed.response) return parsed.response;

  const query = parsed.data;
  const siteAndStub = await resolveSiteAndStub(c, query);
  if (siteAndStub.response) return siteAndStub.response;

  try {
    const summary = await siteAndStub.stub.getEventSummary({
      startDate: dateFromInput(query.startDate),
      endDate: dateFromInput(query.endDate),
      search: query.search,
      limit: query.limit,
      offset: query.offset,
    });

    return c.json(
      {
        site: {
          site_id: siteAndStub.site.site_id,
          site_uuid: siteAndStub.site.uuid,
          name: siteAndStub.site.name,
        },
        summary,
      },
      200,
    );
  } catch (error) {
    return jsonError(
      c,
      500,
      error instanceof Error ? error.message : "Unknown durable object error",
    );
  }
});

const timeSeriesRoute = createRoute({
  method: "get",
  path: "/do/time-series",
  tags: ["Analytics"],
  security: apiSecurity,
  request: {
    query: timeSeriesQuerySchema,
  },
  responses: {
    200: { description: "Time-series data" },
    400: { description: "Bad request", content: { "application/json": { schema: ErrorSchema } } },
    403: { description: "Forbidden", content: { "application/json": { schema: ErrorSchema } } },
    404: { description: "Not found", content: { "application/json": { schema: ErrorSchema } } },
    500: { description: "Server error", content: { "application/json": { schema: ErrorSchema } } },
  },
});

app.openapi(timeSeriesRoute, async (c) => {
  const parsed = parseQuery(c, timeSeriesQuerySchema);
  if (parsed.response) return parsed.response;

  const query = parsed.data;
  const siteAndStub = await resolveSiteAndStub(c, query);
  if (siteAndStub.response) return siteAndStub.response;

  try {
    const timeSeries = await siteAndStub.stub.getTimeSeries({
      startDate: dateFromInput(query.startDate),
      endDate: dateFromInput(query.endDate),
      granularity: query.granularity,
      byEvent: query.byEvent ?? false,
    });

    return c.json(
      {
        site: {
          site_id: siteAndStub.site.site_id,
          site_uuid: siteAndStub.site.uuid,
          name: siteAndStub.site.name,
        },
        timeSeries,
      },
      200,
    );
  } catch (error) {
    return jsonError(
      c,
      500,
      error instanceof Error ? error.message : "Unknown durable object error",
    );
  }
});

const metricsRoute = createRoute({
  method: "get",
  path: "/do/metrics",
  tags: ["Analytics"],
  security: apiSecurity,
  request: {
    query: metricsQuerySchema,
  },
  responses: {
    200: { description: "Metric breakdown" },
    400: { description: "Bad request", content: { "application/json": { schema: ErrorSchema } } },
    403: { description: "Forbidden", content: { "application/json": { schema: ErrorSchema } } },
    404: { description: "Not found", content: { "application/json": { schema: ErrorSchema } } },
    500: { description: "Server error", content: { "application/json": { schema: ErrorSchema } } },
  },
});

app.openapi(metricsRoute, async (c) => {
  const parsed = parseQuery(c, metricsQuerySchema);
  if (parsed.response) return parsed.response;

  const query = parsed.data;
  const siteAndStub = await resolveSiteAndStub(c, query);
  if (siteAndStub.response) return siteAndStub.response;

  try {
    const metrics = await siteAndStub.stub.getMetrics({
      startDate: dateFromInput(query.startDate),
      endDate: dateFromInput(query.endDate),
      metricType: query.metricType,
      limit: query.limit,
    });

    return c.json(
      {
        site: {
          site_id: siteAndStub.site.site_id,
          site_uuid: siteAndStub.site.uuid,
          name: siteAndStub.site.name,
        },
        metrics,
      },
      200,
    );
  } catch (error) {
    return jsonError(
      c,
      500,
      error instanceof Error ? error.message : "Unknown durable object error",
    );
  }
});

const sqlQueryRoute = createRoute({
  method: "post",
  path: "/do/query",
  tags: ["SQL"],
  security: apiSecurity,
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: sqlQueryBodySchema,
        },
      },
    },
  },
  responses: {
    200: { description: "SQL query results" },
    400: { description: "Bad request", content: { "application/json": { schema: ErrorSchema } } },
    403: { description: "Forbidden", content: { "application/json": { schema: ErrorSchema } } },
    404: { description: "Not found", content: { "application/json": { schema: ErrorSchema } } },
    500: { description: "Server error", content: { "application/json": { schema: ErrorSchema } } },
  },
});

app.openapi(sqlQueryRoute, async (c) => {
  const parsedBody = await parseJsonBody(c, sqlQueryBodySchema);
  if (parsedBody.response) return parsedBody.response;

  const body = parsedBody.data;
  const siteAndStub = await resolveSiteAndStub(c, body);
  if (siteAndStub.response) return siteAndStub.response;

  try {
    const result = await siteAndStub.stub.runSqlQuery(
      body.query,
      body.limit ? { limit: body.limit } : undefined,
    );

    if (!result.success) {
      return c.json({ error: result.error ?? "Query failed" }, 400);
    }

    return c.json(
      {
        site: {
          site_id: siteAndStub.site.site_id,
          site_uuid: siteAndStub.site.uuid,
          name: siteAndStub.site.name,
        },
        rows: result.rows ?? [],
        rowCount: result.rowCount ?? 0,
        limit: result.limit,
      },
      200,
    );
  } catch (error) {
    return jsonError(
      c,
      500,
      error instanceof Error ? error.message : "Unknown durable object error",
    );
  }
});

export default app;
