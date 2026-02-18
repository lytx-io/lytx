# `@lytx/core` Self-Host Quickstart

This guide walks through a full self-host setup for `@lytx/core` on Cloudflare using Alchemy.

It assumes you want a user-managed deployment (your own account, resources, domains, and secrets).

## 1) Prerequisites

- Bun installed
- Cloudflare account with access to Workers, D1, KV, Queues, and Durable Objects
- A project that depends on `@lytx/core` (the `demo/` workspace is a starter template)

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

Runtime binding keys expected by `@lytx/core`:

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

- `RESEND_API_KEY` (verification emails)
- `AI_API_KEY`, `AI_MODEL`, `AI_BASE_URL`, `AI_DAILY_TOKEN_LIMIT` (AI features)
- `REPORT_BUILDER`, `ASK_AI` (feature toggles)

Domain and naming options:

- `LYTX_APP_DOMAIN` (custom worker domain)
- `LYTX_TRACKING_DOMAIN` (tracking domain used in `LYTX_DOMAIN` binding)
- `LYTX_RESOURCE_PREFIX`, `LYTX_RESOURCE_SUFFIX`, `LYTX_RESOURCE_STAGE_POSITION`
- per-resource overrides: `LYTX_D1_DATABASE_NAME`, `LYTX_KV_EVENTS_NAME`, `LYTX_KV_CONFIG_NAME`, `LYTX_KV_SESSIONS_NAME`, `LYTX_QUEUE_NAME`, `LYTX_DURABLE_OBJECT_NAMESPACE_NAME`, `LYTX_WORKER_NAME`, `LYTX_DURABLE_HOST_WORKER_NAME`

## 5) Route configuration

`createLytxApp(...)` supports route relocation without source edits:

- tracking routes: `tagRoutes.pathPrefix`
- explicit paths: `tagRoutes.scriptPath`, `tagRoutes.eventPath`, and legacy-path options

Example:

```tsx
import { createLytxApp } from "@lytx/core";

export default createLytxApp({
  tagRoutes: {
    pathPrefix: "/collect",
    dbAdapter: "sqlite",
    useQueueIngestion: true,
  },
});
```

## 6) Local run and deploy

From `demo/`:

```bash
bun run dev
```

Production deploy:

```bash
bun alchemy deploy --stage prod
```

## 7) Troubleshooting

### App boots but APIs return 500

- Check binding keys in Alchemy worker bindings (`LYTX_EVENTS`, `lytx_config`, `lytx_sessions`, `SITE_EVENTS_QUEUE`, `SITE_DURABLE_OBJECT`, `lytx_core_db`).
- Confirm D1/KV/Queue/DO resources exist and were created/adopted in the expected account/stage.

### Auth redirects or email verification links are wrong

- Ensure `BETTER_AUTH_URL` matches the served app origin.
- Ensure `LYTX_DOMAIN`/`LYTX_TRACKING_DOMAIN` align with deployed domains.

### Tracking script or event endpoint returns 404

- Verify `tagRoutes.pathPrefix` and explicit tag/event paths.
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

## 8) Validation checklist

- Worker starts without config validation errors
- Auth flow works (`/signup`, `/login`, verification)
- Tracking script endpoint responds
- Event ingestion writes and dashboard data loads
- Queue-backed ingestion succeeds when enabled
- Deploy stage uses expected resource names and domains
