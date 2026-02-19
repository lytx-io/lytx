# `lytx` Self-Host Quickstart

This guide walks through a full self-host setup for `lytx` on Cloudflare using Alchemy.

It assumes you want a user-managed deployment (your own account, resources, domains, and secrets).

## 1) Prerequisites

- Bun installed
- Cloudflare account with access to Workers, D1, KV, Queues, and Durable Objects
- A project that depends on `lytx` (the `demo/` workspace is a starter template)

## 2) Start from the starter template

The starter template lives in `demo/`:

- `demo/src/worker.tsx`
- `demo/vite.config.ts`
- `demo/alchemy.run.ts`
- `demo/.env.example`

Install dependencies and create local env:

```bash
bun install
cp demo/.env.example demo/.env
```

Then fill required secrets in `demo/.env`.

## 3) Required Cloudflare bindings

Runtime binding keys expected by `lytx`:

- D1: `lytx_core_db`
- KV: `LYTX_EVENTS`, `lytx_config`, `lytx_sessions`
- Queue: `SITE_EVENTS_QUEUE`
- Durable Object: `SITE_DURABLE_OBJECT`

Note: physical Cloudflare resource names are configurable through `resolveLytxResourceNames(...)`; binding keys above stay fixed.

## 4) Required environment variables

Minimum required:

- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `ENCRYPTION_KEY`
- `LYTX_DOMAIN`

Optional but common:

- `EMAIL_FROM`, `RESEND_API_KEY` (verification/invite emails)
- `AI_API_KEY`, `AI_PROVIDER`, `AI_MODEL`, `AI_BASE_URL`, `AI_DAILY_TOKEN_LIMIT` (AI features)
- `REPORT_BUILDER`, `ASK_AI` (feature toggles)

Important: `EMAIL_FROM` must be a real sender address for email workflows. If it is missing (or left as `noreply@example.com`), email send attempts fail with a configuration error.

Domain and naming options:

- `LYTX_APP_DOMAIN` (custom worker domain)
- `LYTX_TRACKING_DOMAIN` (tracking domain used in `LYTX_DOMAIN` binding)
- `LYTX_RESOURCE_PREFIX`, `LYTX_RESOURCE_SUFFIX`, `LYTX_RESOURCE_STAGE_POSITION`
- per-resource overrides: `LYTX_D1_DATABASE_NAME`, `LYTX_KV_EVENTS_NAME`, `LYTX_KV_CONFIG_NAME`, `LYTX_KV_SESSIONS_NAME`, `LYTX_QUEUE_NAME`, `LYTX_DURABLE_OBJECT_NAMESPACE_NAME`, `LYTX_WORKER_NAME`, `LYTX_DURABLE_HOST_WORKER_NAME`

## 5) Route configuration

`createLytxApp(...)` supports route relocation without source edits:

- tracking routes: `trackingRoutePrefix`
- explicit paths: `tagRoutes.scriptPath`, `tagRoutes.eventPath`, and legacy-path options
- runtime adapter/ingestion controls: `db.dbAdapter`, `db.eventStore` (defaults to `durable_objects`), `useQueueIngestion`
- auth controls: `auth.emailPasswordEnabled`, `auth.requireEmailVerification`, `auth.socialProviders.google`, `auth.socialProviders.github`

Example:

```tsx
import { createLytxApp } from "lytx";

export default createLytxApp({
  db: {
    dbAdapter: "sqlite",
    eventStore: "durable_objects",
  },
  trackingRoutePrefix: "/collect",
  auth: {
    socialProviders: {
      google: true,
      github: false,
    },
  },
});
```

## 6) Initial admin bootstrap

- On a fresh install, the first successful account signup becomes the default admin and creates the initial team.
- Subsequent non-invited signups are added to the initial team with viewer access.
- Team admins can then invite additional users with elevated roles from settings.

CLI fallback (for locked-down or scripted installs):

```bash
cd core
bun run cli/bootstrap-admin.ts --email admin@example.com --password "StrongPassword123"
```

For remote Cloudflare D1:

```bash
cd core
bun run cli/bootstrap-admin.ts --email admin@example.com --password "StrongPassword123" --remote
```

## 7) Local run and deploy

From `demo/`:

```bash
bun run dev
```

Production deploy:

```bash
bun alchemy deploy --stage prod
```

## 8) Troubleshooting

### App boots but APIs return 500

- Check binding keys in Alchemy worker bindings (`LYTX_EVENTS`, `lytx_config`, `lytx_sessions`, `SITE_EVENTS_QUEUE`, `SITE_DURABLE_OBJECT`, `lytx_core_db`).
- Confirm D1/KV/Queue/DO resources exist and were created/adopted in the expected account/stage.

### Auth redirects or email verification links are wrong

- Ensure `BETTER_AUTH_URL` matches the served app origin.
- Ensure `LYTX_DOMAIN`/`LYTX_TRACKING_DOMAIN` align with deployed domains.

### Tracking script or event endpoint returns 404

- Verify `trackingRoutePrefix` and explicit tag/event paths.
- Confirm client-side snippet points at the final prefixed path.

### Dashboard pages unreachable

- Check feature toggles (`LYTX_FEATURE_DASHBOARD`, `LYTX_FEATURE_AUTH`, `REPORT_BUILDER`, etc.).
- `dashboard` requires `auth`; invalid combinations are rejected by startup validation.

### Queue ingestion not processing

- Confirm `SITE_EVENTS_QUEUE` binding is present.
- Verify queue consumer settings in `alchemy.run.ts` and that the queue is attached in `eventSources`.

### Resource names unexpectedly differ between stages

- Check naming strategy env vars (`LYTX_RESOURCE_*`) and per-resource overrides.
- Keep strategy stable across deploys to remain idempotent.

## 9) Validation checklist

- Worker starts without config validation errors
- Auth flow works (`/signup`, `/login`, verification)
- Tracking script endpoint responds
- Event ingestion writes and dashboard data loads
- Queue-backed ingestion succeeds when enabled
- Deploy stage uses expected resource names and domains
