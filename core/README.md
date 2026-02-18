# Lytx Kit – Core

Open-source web analytics platform built on [RedwoodSDK](https://rwsdk.com) (rwsdk) and Cloudflare Workers. Ship a full analytics dashboard — event ingestion, dashboards, team management, auth — inside your own Redwood app.

## OSS contract

The supported public API surface for `@lytx/core` is documented in `core/docs/oss-contract.md`.

- Contract doc: [`docs/oss-contract.md`](./docs/oss-contract.md)
- Read this first before relying on any non-root or deep import path.

## How it works

`@lytx/core` exports route, page, component, middleware, and Durable Object building blocks as named exports from the package root. The primary integration path is to import these into your own `src/worker.tsx`, wire them into `defineApp`, and deploy with your existing rwsdk toolchain.

An experimental pre-wired worker entrypoint also exists at `@lytx/core/worker`; this entrypoint is intentionally not part of the stable API contract.

Think of it like a parts catalog: pull in the full analytics stack, or cherry-pick just the event ingestion API and build your own UI.

## Prerequisites

- [Bun](https://bun.sh) (runtime)
- A Redwood SDK (rwsdk) project — `npx rwsdk@latest new my-app`
- Cloudflare account (D1, KV, Durable Objects, Queues)

## Installation

```bash
# from your rwsdk project root
bun add @lytx/core
```

> Until this is published to npm, add it as a workspace dependency or link it locally.

## Quick start — full analytics stack

This drops the entire Lytx analytics platform into your Redwood app. Copy-paste into your `src/worker.tsx` and adjust as needed.

```tsx
// src/worker.tsx
import { defineApp, type RequestInfo } from "rwsdk/worker";
import { route, render, prefix, layout } from "rwsdk/router";
import type { ExportedHandler } from "cloudflare:workers";
import { IS_DEV } from "rwsdk/constants";

import {
  // Document shell
  Document,

  // Public pages
  Home,
  Signup,
  Login,
  VerifyEmail,
  GetStarted,
  PrivacyPolicy,
  TermsOfService,

  // Authenticated app pages
  AppLayout,
  DashboardPage,
  EventsPage,
  ExplorePage,
  SettingsPage,
  NewSiteSetup,
  DashboardWorkspaceLayout,
  ReportBuilderWorkspace,
  CustomReportBuilderPage,

  // API routes
  eventsApi,
  seedApi,
  team_dashboard_endpoints,
  world_countries,
  getCurrentVisitorsRoute,
  getDashboardDataRoute,
  siteEventsSqlRoute,
  siteEventsSchemaRoute,
  aiChatRoute,
  aiConfigRoute,
  aiTagSuggestRoute,
  resendVerificationEmailRoute,
  userApiRoutes,
  eventLabelsApi,
  reportsApi,
  legacyContainerRoute,
  newSiteSetup,
  lytxTag,
  trackWebEvent,
  handleQueueMessage,

  // Middleware
  authMiddleware,
  sessionMiddleware,

  // Auth
  auth,

  // Route guards
  checkIfTeamSetupSites,
  onlyAllowGetPost,

  // Durable Objects (re-export so Cloudflare can find them)
  SyncDurableObject,
  SiteDurableObject,

  // Types
  type AppContext,
  type DBAdapter,
} from "@lytx/core";

export { SyncDurableObject, SiteDurableObject };

type AppRequestInfo = RequestInfo<any, AppContext>;

const dbAdapter: DBAdapter = "sqlite";

const app = defineApp<AppRequestInfo>([
  ({ request }) => {
    if (IS_DEV) console.log(request.method, request.url);
  },

  // ── Tag & event ingestion (unauthenticated) ──
  legacyContainerRoute,
  lytxTag(dbAdapter),
  trackWebEvent(dbAdapter, "/trackWebEvent", { useQueue: true }),
  eventsApi,
  seedApi,

  // ── Auth API ──
  route("/api/auth/*", (r) => authMiddleware(r)),
  resendVerificationEmailRoute,
  userApiRoutes,

  // ── Rendered pages ──
  render<AppRequestInfo>(Document, [
    route("/", [onlyAllowGetPost, () => <Home />]),
    route("/signup", [onlyAllowGetPost, () => <Signup />]),
    route("/login", [onlyAllowGetPost, () => <Login />]),
    route("/get-started", [onlyAllowGetPost, () => <GetStarted />]),
    route("/privacy", [onlyAllowGetPost, () => <PrivacyPolicy />]),
    route("/terms", [onlyAllowGetPost, () => <TermsOfService />]),
    route("/verify-email", [
      onlyAllowGetPost,
      async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token") || "";
        if (!token) {
          return <VerifyEmail status={{ type: "error", message: "Missing token." }} />;
        }
        try {
          await auth.api.verifyEmail({ query: { token } });
          return <VerifyEmail status={{ type: "success", message: "Email verified." }} />;
        } catch {
          return <VerifyEmail status={{ type: "error", message: "Verification failed." }} />;
        }
      },
    ]),

    // ── Authenticated app shell ──
    layout(AppLayout, [
      sessionMiddleware,

      // Authenticated API routes
      prefix("/api", [
        world_countries,
        getDashboardDataRoute,
        getCurrentVisitorsRoute,
        aiConfigRoute,
        aiChatRoute,
        aiTagSuggestRoute,
        siteEventsSqlRoute,
        siteEventsSchemaRoute,
        eventLabelsApi,
        reportsApi,
        newSiteSetup(),
        team_dashboard_endpoints,
      ]),

      onlyAllowGetPost,

      // Dashboard pages
      route("/dashboard", [
        checkIfTeamSetupSites,
        () => <DashboardPage activeReportBuilderItemId="create-report" />,
      ]),
      layout(DashboardWorkspaceLayout, [
        route("/dashboard/reports/create-report", [
          checkIfTeamSetupSites,
          () => <ReportBuilderWorkspace activeReportBuilderItemId="create-report" />,
        ]),
        route("/dashboard/reports/custom/new", [
          checkIfTeamSetupSites,
          ({ request }) => {
            const template = new URL(request.url).searchParams.get("template");
            return <CustomReportBuilderPage initialTemplate={template} />;
          },
        ]),
        // ... add more report routes as needed
      ]),
      route("/dashboard/events", [checkIfTeamSetupSites, () => <EventsPage />]),
      route("/dashboard/settings", [() => <SettingsPage />]),
      route("/dashboard/explore", [checkIfTeamSetupSites, () => <ExplorePage />]),
      route("/dashboard/new-site", [() => <NewSiteSetup />]),
    ]),
  ]),
]);

export default {
  fetch: app.fetch,
  queue: handleQueueMessage,
} satisfies ExportedHandler<Env>;
```

## Minimal setup — event ingestion only

If you only need the tracking pixel and event API (no dashboard UI):

```tsx
// src/worker.tsx
import { defineApp, type RequestInfo } from "rwsdk/worker";
import { route } from "rwsdk/router";
import type { ExportedHandler } from "cloudflare:workers";
import {
  lytxTag,
  trackWebEvent,
  eventsApi,
  handleQueueMessage,
  authMiddleware,
  type AppContext,
} from "@lytx/core";

export { SiteDurableObject } from "@lytx/core";

type AppRequestInfo = RequestInfo<any, AppContext>;

const app = defineApp<AppRequestInfo>([
  lytxTag("sqlite"),
  trackWebEvent("sqlite", "/trackWebEvent", { useQueue: true }),
  eventsApi,
  route("/api/auth/*", (r) => authMiddleware(r)),
]);

export default {
  fetch: app.fetch,
  queue: handleQueueMessage,
} satisfies ExportedHandler<Env>;
```

## Cloudflare bindings

Your `wrangler.jsonc` (or `alchemy.run.ts`) needs these bindings for the full stack:

| Binding | Type | Purpose |
|---|---|---|
| `lytx_core_db` | D1 Database | Primary data store (users, teams, sites, events) |
| `LYTX_EVENTS` | KV Namespace | Event storage / caching |
| `lytx_config` | KV Namespace | Configuration store |
| `lytx_sessions` | KV Namespace | Session storage |
| `SITE_EVENTS_QUEUE` | Queue | Async event ingestion |
| `SITE_DURABLE_OBJECT` | Durable Object | Per-site event aggregation |

### Environment variables

Add these to your `.env` (local) or worker secrets (production):

```env
# Required
BETTER_AUTH_SECRET=<random-secret>
BETTER_AUTH_URL=http://localhost:5173
ENCRYPTION_KEY=<random-secret>

# Auth providers (optional — enable the ones you want)
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Email (optional — needed for verification emails)
RESEND_API_KEY=...

# AI features (optional)
AI_API_KEY=...
AI_BASE_URL=...
AI_MODEL=...
AI_DAILY_TOKEN_LIMIT=

# Report builder toggle (optional)
# Set to `true` to enable report routes and UI
REPORT_BUILDER=false
# Set to `false` to hide Ask AI while keeping report builder enabled
ASK_AI=true

# Misc
LYTX_DOMAIN=localhost:5173
ENVIRONMENT=development
SEED_DATA_SECRET=<random-secret>
```

## Database setup

Generate and apply D1 migrations:

```bash
bunx drizzle-kit generate --config=db/d1/drizzle.config.ts
wrangler d1 migrations apply lytx-core-db --local
```

Seed dev data:

```bash
bun run cli/seed-data.ts --team-id 1 --site-id 1 --durable-only --events 50 --seed-secret "$SEED_DATA_SECRET"
```

## What's included

### API Routes

| Export | Path | Description |
|---|---|---|
| `lytxTag` | `/lytx.js` | JavaScript tracking tag |
| `trackWebEvent` | `/trackWebEvent` | Event ingestion endpoint |
| `eventsApi` | `/api/events/*` | Event CRUD |
| `getDashboardDataRoute` | `/api/dashboard-data` | Dashboard aggregation |
| `getCurrentVisitorsRoute` | `/api/current-visitors` | Real-time visitor count |
| `siteEventsSqlRoute` | `/api/sql` | Raw SQL query interface |
| `team_dashboard_endpoints` | `/api/team/*` | Team management |
| `eventLabelsApi` | `/api/event-labels/*` | Event label CRUD |
| `reportsApi` | `/api/reports/*` | Custom reports |
| `aiChatRoute` | `/api/ai/chat` | AI data assistant |
| `authMiddleware` | `/api/auth/*` | better-auth handler |

### Pages & Components

| Export | Description |
|---|---|
| `DashboardPage` | Main analytics dashboard with charts, maps, tables |
| `EventsPage` | Event explorer / raw event viewer |
| `ExplorePage` | SQL explorer with Monaco editor |
| `SettingsPage` | Team settings, API keys, site tag install |
| `Home`, `Signup`, `Login` | Marketing / auth pages |
| `AppLayout` | Authenticated app shell with nav |
| `Document` | HTML document wrapper |

### Middleware

| Export | Description |
|---|---|
| `authMiddleware` | Handles `/api/auth/*` (better-auth) |
| `sessionMiddleware` | Loads user session + team context into `AppContext` |
| `onlyAllowGetPost` | Rejects non-GET/POST requests |
| `checkIfTeamSetupSites` | Redirects to setup if team has no sites |

### Durable Objects

| Export | Description |
|---|---|
| `SiteDurableObject` | Per-site event storage and aggregation |
| `SyncDurableObject` | Session synchronization |

> You **must** re-export Durable Objects from your worker entry point so Cloudflare can instantiate them.

## Customization

Since you control `defineApp`, you can:

- **Drop routes** you don't need (remove the AI routes, the seed API, etc.)
- **Add your own routes** alongside Lytx routes
- **Replace pages** with your own React components while keeping the API routes
- **Mount under a prefix** — wrap Lytx routes in `prefix("/analytics", [...])`
- **Swap the DB adapter** — pass `"postgres"` instead of `"sqlite"` to tag routes
- **Add middleware** — insert your own auth/rate-limiting before or after `sessionMiddleware`

## License

MIT
