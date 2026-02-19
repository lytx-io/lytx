# `@lytx/core` Upgrade and Migration Guide

This guide covers migration steps for behavior and API changes across `@lytx/core` releases.

Use it together with:

- `docs/oss-contract.md` (public API boundaries)
- `docs/release-policy.md` (semver + compatibility matrix)

## Migration checklist

When upgrading `@lytx/core`:

1. Read release notes/changelog for your target version.
2. Compare your imports against the OSS contract (remove deep/internal imports).
3. Validate `createLytxApp(...)` config against the latest schema.
4. Re-check resource naming/domain/route settings in `alchemy.run.ts`.
5. Run OSS smoke checks (`bun run ci:oss`) and your deployment checks.

## Breaking/behavioral migration notes

## Import path normalization (legacy deep imports)

### Previous pattern

- Deep imports such as `@lytx/core/db/durable/siteDurableObject`
- Pre-wired worker usage through `@lytx/core/worker`

### Current recommended pattern

- Prefer root exports from `@lytx/core`
- Use `createLytxApp(...)` for canonical worker bootstrap

### Migration

- Replace deep imports with root imports where available.
- Keep `@lytx/core/worker` usage only if you explicitly accept experimental/unstable surface.

## `createLytxApp` config shape updates

### Previous pattern

- `dbAdapter` and `useQueueIngestion` nested under `tagRoutes`.

### Current pattern

- Use typed DB controls for runtime behavior:
  - `db.dbAdapter`
  - `db.eventStore`
  - `useQueueIngestion`
  - `includeLegacyTagRoutes`
  - `trackingRoutePrefix`
- Keep endpoint path overrides under `tagRoutes` (`scriptPath`, `eventPath`, legacy path overrides).

### Migration

- Move adapter/event-store settings from `tagRoutes` to `db`.
- Keep route-path customization in `tagRoutes`.

## Worker bootstrap migration (manual wiring -> app factory)

### Previous pattern

- Manually assembling large route stacks in consumer worker files.

### Current pattern

- `createLytxApp(config)` as the stable integration entrypoint.

### Migration

- Move to:

```tsx
import { createLytxApp, SiteDurableObject, SyncDurableObject } from "@lytx/core";

const app = createLytxApp({
  db: {
    dbAdapter: "sqlite",
    eventStore: "durable_objects",
  },
});

export { SiteDurableObject, SyncDurableObject };
export default app;
```

## Resource naming strategy migration

### Previous pattern

- Hardcoded resource names in `alchemy.run.ts`.

### Current pattern

- Deterministic naming via `resolveLytxResourceNames(...)` with optional stage prefix/suffix and per-resource overrides.

### Migration

- Add naming strategy env vars (`LYTX_RESOURCE_*`) and optional per-resource overrides.
- Keep runtime binding keys unchanged (`LYTX_EVENTS`, `lytx_config`, `lytx_sessions`, `SITE_EVENTS_QUEUE`, `SITE_DURABLE_OBJECT`, `lytx_core_db`).

## Domain and route-prefix migration

### Previous pattern

- Domain and endpoint path changes often required source edits.

### Current pattern

- Deployment-level domain controls:
  - `LYTX_APP_DOMAIN`
  - `LYTX_TRACKING_DOMAIN`
- Route-prefix support for tracking endpoints:
  - `createLytxApp({ trackingRoutePrefix: "/collect" })`

### Migration

- Move domain customization to env/config in `alchemy.run.ts`.
- Use `trackingRoutePrefix` and route path options instead of editing core route source.

## Feature toggles migration

### Previous pattern

- Mostly env-only toggles (`REPORT_BUILDER`, `ASK_AI`).

### Current pattern

- Modular flags supported via config/env for dashboard/events/auth/ai/tag script.

### Migration

- Define feature behavior in `createLytxApp({ features: ... })` and keep env flags aligned.
- Resolve invalid combinations flagged by startup validation (for example, `dashboard` requires `auth`).

## Compatibility caveats

- Check `docs/release-policy.md` compatibility matrix for Alchemy/rwsdk/Wrangler/Vite support targets.
- If your stack is outside supported ranges, pin versions or test in a staging environment before upgrading.

## Reporting migration issues

- Open a bug report using `.github/ISSUE_TEMPLATE/bug_report.md`.
- Include current version, target version, and the failing migration step.
