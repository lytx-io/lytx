# Lytx Kit – Core

Open-source web analytics platform built on [RedwoodSDK](https://rwsdk.com) (rwsdk) and Cloudflare Workers. Ship a full analytics dashboard — event ingestion, dashboards, team management, auth — inside your own Redwood app.

## OSS contract

The supported public API surface for `lytx` is documented in `core/docs/oss-contract.md`.

- Contract doc: [`docs/oss-contract.md`](./docs/oss-contract.md)
- Self-host quickstart: [`docs/self-host-quickstart.md`](./docs/self-host-quickstart.md)
- Semver/release policy: [`docs/release-policy.md`](./docs/release-policy.md)
- Changelog: [`docs/changelog.md`](./docs/changelog.md)
- Upgrade/migration guide: [`docs/migration-guide.md`](./docs/migration-guide.md)
- Read this first before relying on any non-root or deep import path.

## How it works

`lytx` exposes a canonical app factory, `createLytxApp`, from the package root. Use it to bootstrap a full worker without importing internals. For advanced composition, root exports also include route, page, middleware, and Durable Object building blocks.

An experimental pre-wired worker entrypoint also exists at `lytx/worker`; this entrypoint is intentionally not part of the stable API contract.

Think of it like a parts catalog: pull in the full analytics stack, or cherry-pick just the event ingestion API and build your own UI.

## Prerequisites

- [Bun](https://bun.sh) (runtime)
- A Redwood SDK (rwsdk) project — `npx rwsdk@latest new my-app`
- Cloudflare account (D1, KV, Durable Objects, Queues)

## Installation

```bash
# from your rwsdk project root
bun add lytx
```

> Until this is published to npm, add it as a workspace dependency or link it locally.

## Quick start — app factory (recommended)

Use the root app factory to bootstrap the full analytics stack with one import:

```tsx
// src/worker.tsx
import type { ExportedHandler } from "cloudflare:workers";
import { createLytxApp, SyncDurableObject, SiteDurableObject } from "lytx";

const app = createLytxApp({
  db: {
    dbAdapter: "sqlite",
    eventStore: "durable_objects",
  },
  auth: {
    socialProviders: {
      google: true,
      github: false,
    },
  },
});

export { SyncDurableObject, SiteDurableObject };

export default app satisfies ExportedHandler<Env>;
```

Add the Vite plugin preset so Redwood can resolve Lytx internals without manual alias setup:

```ts
// vite.config.ts
import { defineConfig } from "vite";
import alchemy from "alchemy/cloudflare/redwood";
import tailwindcss from "@tailwindcss/vite";
import { lytxConsumerVitePlugin } from "lytx/vite";

export default defineConfig({
  plugins: [...lytxConsumerVitePlugin(), alchemy(), tailwindcss()],
});
```

`lytxConsumerVitePlugin()` uses built-in `lytx` defaults for both document and client entry, so consumers do not need local `src/Document.tsx` or `src/client.tsx`. To customize the document wrapper, use `createLytxApp({ routes: { document } })`.

For custom document wrappers, import the public stylesheet entrypoint:

```tsx
import styles from "lytx/styles.css?url";
```

When providing a custom document, render `{children}` directly (do not wrap it in another `hydrate-root` container):

```tsx
{children}
```

`createLytxApp` supports:

- `features.dashboard`, `features.events`, `features.auth`, `features.ai`, `features.tagScript`
- `db.dbAdapter` (`"sqlite" | "postgres" | "singlestore" | "analytics_engine"`)
- `db.eventStore` (`db.dbAdapter` values + `"durable_objects"`; defaults to `"durable_objects"`)
- `useQueueIngestion` (`true`/`false`)
- `includeLegacyTagRoutes` (`true` by default for `/lytx.v2.js` and `/trackWebEvent.v2` compatibility)
- `trackingRoutePrefix` (prefix all tracking routes, e.g. `/collect`)
- `tagRoutes.scriptPath` + `tagRoutes.eventPath` (custom v2 route paths)
- `auth.emailPasswordEnabled`, `auth.requireEmailVerification`, `auth.socialProviders.google`, `auth.socialProviders.github`
- `auth.signupMode` (`"open" | "bootstrap_then_invite" | "invite_only" | "demo"`; default is `"bootstrap_then_invite"`)
- `ai.provider`, `ai.model`, `ai.baseURL`, `ai.apiKey`, `ai.accountId` (runtime AI vendor/model overrides; blank values are ignored; provider/model include preset autocomplete values)
- `features.reportBuilderEnabled` + `features.askAiEnabled`
- `names.*` (typed resource binding names for D1/KV/Queue/DO)
- `domains.app` + `domains.tracking` (typed host/domain values)
- `startupValidation.*` + `env.*` (startup env requirement checks with field-level errors)
- `env.AI_PROVIDER`, `env.AI_BASE_URL`, `env.AI_MODEL` (AI vendor/model routing overrides)
- `env.EMAIL_FROM` (optional factory override for outgoing email sender)
- `routes.ui.dashboard`, `routes.ui.events`, `routes.ui.explore` (typed per-route UI overrides with route-specific `info`/props)
- `routes.document` (typed RedwoodSDK `Document` override for render wrapper)
- `routes.additionalRoutes` (typed RedwoodSDK route entries appended to core route tree)

### Route UI overrides

Use `routes.ui` when you want to keep core routing/middleware but swap page UI for specific routes:

```tsx
import {
  DashboardPage,
  EventsPage,
  ExplorePage,
  createLytxApp,
  type DashboardPageProps,
} from "lytx";
import { route, type DocumentProps } from "rwsdk/router";

function CustomDocument({ children }: DocumentProps) {
  return (
    <html lang="en">
      <body data-app="custom-document">{children}</body>
    </html>
  );
}

const app = createLytxApp({
  routes: {
    document: CustomDocument,
    additionalRoutes: [
      route("/dashboard/custom", ({ ctx }) => {
        return new Response(`Hello team ${ctx.team.id}`);
      }),
    ],
    ui: {
      dashboard: ({ info, defaultProps, helpers }) => {
        // Keep calling the same APIs/helpers core expects for this route.
        // See /api docs before replacing route UI behavior.
        const _teamId = info.ctx.team.id;
        const _dashboardFetcher = helpers.getDashboardDataCore;
        const _initialData = defaultProps.reportData.initialDashboardData;

        const { reportData, ...pageProps } = defaultProps;

        const customProps: DashboardPageProps = {
          ...pageProps,
          ...reportData,
          activeReportBuilderItemId: "create-report",
        };

        return <DashboardPage {...customProps} />;
      },
      events: ({ info }) => {
        const _userId = info.ctx.session.user.id;
        return <EventsPage />;
      },
      explore: ({ defaultProps }) => {
        return <ExplorePage {...defaultProps} />;
      },
    },
  },
});
```

TypeScript autocomplete is route-specific. For example, `routes.ui.dashboard` exposes dashboard defaults/helpers, while `routes.ui.explore` only exposes explore defaults.
`routes.additionalRoutes` enforces RedwoodSDK route entry types.

For deployment scripts, use `resolveLytxResourceNames(...)` from `lytx/resource-names` to derive deterministic Cloudflare resource names with optional stage-based prefix/suffix strategy.

## Quick start — manual composition (advanced)

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
  Signup,
  Login,
  VerifyEmail,

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
} from "lytx";

export { SyncDurableObject, SiteDurableObject };

type AppRequestInfo = RequestInfo<any, AppContext>;

const dbAdapter: DBAdapter = "sqlite";

const app = defineApp<AppRequestInfo>([
  ({ request }) => {
    if (IS_DEV) console.log(request.method, request.url);
  },

  // ── Tag & event ingestion (unauthenticated) ──
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
    route("/", [onlyAllowGetPost, ({ request }) => Response.redirect(new URL("/login", request.url).toString(), 308)]),
    route("/signup", [onlyAllowGetPost, () => <Signup />]),
    route("/login", [onlyAllowGetPost, () => <Login />]),
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

## Consumer starter template

For a copy/paste starter workspace (worker + vite + `alchemy.run.ts`) that uses public root exports, see `demo/README.md`.

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
} from "lytx";

export { SiteDurableObject } from "lytx";

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

### Resource naming strategy

Resource binding keys in worker code stay fixed (`LYTX_EVENTS`, `lytx_config`, etc.), but physical Cloudflare resource names can be configured deterministically in `alchemy.run.ts` via `resolveLytxResourceNames` (`lytx/resource-names`).

Supported naming env vars:

```env
# Optional global strategy
LYTX_RESOURCE_PREFIX=
LYTX_RESOURCE_SUFFIX=
# one of: prefix | suffix | none
LYTX_RESOURCE_STAGE_POSITION=none

# Optional per-resource overrides
LYTX_WORKER_NAME=
LYTX_DURABLE_HOST_WORKER_NAME=
LYTX_DURABLE_OBJECT_NAMESPACE_NAME=
LYTX_D1_DATABASE_NAME=
LYTX_KV_EVENTS_NAME=
LYTX_KV_CONFIG_NAME=
LYTX_KV_SESSIONS_NAME=
LYTX_QUEUE_NAME=
```

This keeps naming deterministic across deploys and avoids accidental resource drift between stages.

### Domain and route prefix strategy

Use these env vars in `alchemy.run.ts` to configure app/tracking domains without editing source:

```env
# Optional custom worker domain
LYTX_APP_DOMAIN=analytics.example.com

# Optional tracking domain used in LYTX_DOMAIN binding
LYTX_TRACKING_DOMAIN=collect.example.com
```

Use `createLytxApp({ tagRoutes: { pathPrefix: "/collect" } })` to prefix tracking script and ingestion endpoints.

### Auth setup (important)

`createLytxApp` defaults to bootstrap-safe auth behavior:

- `auth.signupMode` defaults to `"bootstrap_then_invite"`.
- First account signup is allowed and becomes the initial admin.
- After the first account exists, public signup is automatically closed.
- New users can then register only through team invites.

This default applies when:

- `auth` is omitted entirely, or
- `auth: {}` is passed.

Use these explicit modes when you need different behavior:

```tsx
createLytxApp({
  auth: {
    // "bootstrap_then_invite" is the default
    signupMode: "bootstrap_then_invite",
    // signupMode: "invite_only", // never allow public signup
    // signupMode: "open", // always allow public signup
    // signupMode: "demo", // DISABLES auth and makes dashboard/app routes publicly accessible
  },
});
```

`"demo"` mode is intentionally unsafe for production. It bypasses login/session requirements for dashboard and app routes so anyone with the URL can access the product experience.

If you need to bootstrap an admin user without public signup, use the CLI:

```bash
cd core
bun run cli/bootstrap-admin.ts --email admin@example.com --password "StrongPassword123"
```

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

# Email (required for verification/invite emails)
EMAIL_FROM=noreply@yourdomain.com
RESEND_API_KEY=...

# AI features (optional)
AI_API_KEY=...
AI_ACCOUNT_ID=...
AI_PROVIDER=openai
AI_BASE_URL=...
AI_MODEL=...
AI_DAILY_TOKEN_LIMIT=

# Report builder toggle (optional)
# Set to `true` to enable report routes and UI
REPORT_BUILDER=false
# Set to `false` to hide Ask AI while keeping report builder enabled
ASK_AI=true

# Modular feature toggles (optional)
LYTX_FEATURE_DASHBOARD=true
LYTX_FEATURE_EVENTS=true
LYTX_FEATURE_AUTH=true
LYTX_FEATURE_AI=true
LYTX_FEATURE_TAG_SCRIPT=true

# Misc
LYTX_DOMAIN=localhost:5173
ENVIRONMENT=development
SEED_DATA_SECRET=<random-secret>
```

If `EMAIL_FROM` is missing (or left as the placeholder `noreply@example.com`), email send attempts fail with a clear runtime error explaining how to configure it.

On a fresh install, the first successful signup becomes the initial admin and creates the default team. For scripted/bootstrap environments, you can use:

```bash
cd core
bun run cli/bootstrap-admin.ts --email admin@example.com --password "StrongPassword123"
```

Use `--remote` to apply bootstrap changes directly to Cloudflare D1 via Wrangler. This requires Wrangler authentication (`wrangler login` or a valid Cloudflare API token) and access to the target database.

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

### App Factory

| Export | Description |
|---|---|
| `createLytxApp` | Canonical factory that returns a worker handler (`fetch` + `queue`) with configurable tag routes and feature toggles |

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
| `Signup`, `Login`, `VerifyEmail` | Auth pages |
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
