# `lytx` OSS Contract

This document defines the supported public API contract for `lytx`.

If an import path or behavior is not listed here as supported, treat it as internal and subject to change without notice.

## Scope and intent

- The stable integration model is composition: consumers assemble their own `defineApp(...)` worker from root exports.
- The package root (`lytx`) is the canonical public entrypoint.
- Non-root subpath exports may exist for compatibility and migration, but are explicitly categorized below.

## Supported public exports (stable)

The following are supported under semantic versioning guarantees (see policy below) when imported from `lytx`.

### Pages and shells

- `Document`
- `Signup`, `Login`, `VerifyEmail`
- `AppLayout`
- `DashboardPage`, `EventsPage`, `ExplorePage`, `SettingsPage`
- `NewSiteSetup`, `DashboardWorkspaceLayout`, `ReportBuilderWorkspace`, `CustomReportBuilderPage`

### Route and API building blocks

- `eventsApi`, `seedApi`
- `team_dashboard_endpoints`
- `world_countries`, `getCurrentVisitorsRoute`, `getDashboardDataRoute`, `siteEventsSqlRoute`, `siteEventsSchemaRoute`
- `aiChatRoute`, `aiConfigRoute`, `aiTagSuggestRoute`
- `resendVerificationEmailRoute`, `userApiRoutes`
- `eventLabelsApi`, `reportsApi`
- `legacyContainerRoute`, `newSiteSetup`
- `lytxTag`, `trackWebEvent`
- `handleQueueMessage`

### Middleware, auth, durable objects, and types

- `createLytxApp`, `CreateLytxAppConfig`
- `resolveLytxResourceNames`, `DEFAULT_LYTX_RESOURCE_NAMES`
- `LytxResourceNames`, `LytxResourceNamingOptions`, `LytxResourceStagePosition`
- `authMiddleware`, `sessionMiddleware`
- `auth`
- `checkIfTeamSetupSites`, `onlyAllowGetPost`
- `SyncDurableObject`, `SiteDurableObject`
- `DashboardPageProps`, `AuthUserSession`, `AppContext`, `DBAdapter`, `UserRole`, `SitesContext`, `TeamContext`

For Node/Alchemy deployment scripts, prefer importing naming helpers from `lytx/resource-names` to avoid loading worker-only modules.

## Supported public exports (experimental / unstable)

These are allowed for consumers but may change in minor releases and may be removed after deprecation notice.

- `lytx/worker`
  - Pre-wired worker bundle for turnkey usage.
  - Intended for fast start and compatibility, not long-term pinned integrations.
- `lytx/db/durable/siteDurableObject`
  - Legacy typed subpath export.
  - Prefer `SiteDurableObject` from `lytx`.
- `lytx/resource-names`
  - Node-safe subpath for deployment naming helpers (`resolveLytxResourceNames`, related types/constants).

## Internal/private modules (not supported)

The following are not supported for external consumers and can change at any time:

- Any deep import not listed above, including paths like:
  - `lytx/src/*`
  - `lytx/db/*` (except `lytx/db/durable/siteDurableObject`, which is experimental)
  - `lytx/lib/*`
  - `lytx/endpoints/*`
  - `lytx/cli/*`
  - `lytx/public/*`
  - `lytx/vite/*`
- Internal file layout, route implementation details, and schema internals.

## Supported extension and customization points

### Feature flags

- `REPORT_BUILDER`: enables report-builder routes and UI.
- `ASK_AI`: toggles Ask AI surfaces when report builder is enabled.
- `LYTX_FEATURE_DASHBOARD`: enables authenticated dashboard shell/routes.
- `LYTX_FEATURE_EVENTS`: enables events API and dashboard events surfaces.
- `LYTX_FEATURE_AUTH`: enables auth routes/pages.
- `LYTX_FEATURE_AI`: enables AI routes/features.
- `LYTX_FEATURE_TAG_SCRIPT`: enables tag script routes.
- `createLytxApp(config)` validates feature overrides at startup and fails fast on invalid combinations.

### Resource naming and bindings

The contract supports configuring and binding these Cloudflare resources in consumer workers:

- D1: `lytx_core_db`
- KV: `LYTX_EVENTS`, `lytx_config`, `lytx_sessions`
- Queue: `SITE_EVENTS_QUEUE`
- Durable Object namespace: `SITE_DURABLE_OBJECT`

Consumers may choose deployment-level names, but the runtime bindings exposed to the worker must match the expected binding keys above.

`createLytxApp(config)` includes typed `names.*` validation for resource/binding naming, with field-level startup errors when invalid.

`resolveLytxResourceNames(options)` is the supported deterministic naming strategy helper for deployment scripts, including stage-based prefixes/suffixes and per-resource overrides.

### Domain and environment configuration

- `LYTX_DOMAIN` is the supported domain-facing configuration variable.
- `LYTX_APP_DOMAIN` and `LYTX_TRACKING_DOMAIN` are supported deployment-level domain config variables in `alchemy.run.ts`.
- Auth and integration behavior are configured via documented env vars in `README.md`.
- `createLytxApp(config)` accepts typed `domains.*` and `env.*` values and provides startup validation errors with docs links.
- AI runtime routing supports `AI_PROVIDER`, `AI_BASE_URL`, and `AI_MODEL` for provider/model override behavior.
- Email workflows require a valid sender (`EMAIL_FROM`), configurable via environment bindings or `createLytxApp({ env: { EMAIL_FROM } })`.

### Composition and routing

- Consumers can mount exported routes under custom prefixes (`prefix("/analytics", [...])`).
- Consumers can include/exclude route groups and pages by composing exports into their own worker.
- Consumers can layer additional middleware before/after provided middleware.
- `createLytxApp({ trackingRoutePrefix })` is the supported route-prefix mechanism for tracking/tag endpoints.
- `createLytxApp` supports typed DB runtime controls via `db.dbAdapter` and `db.eventStore` (`durable_objects` supported), plus `useQueueIngestion` and `includeLegacyTagRoutes`.
- `createLytxApp` supports auth-mode controls via `auth.emailPasswordEnabled`, `auth.requireEmailVerification`, and `auth.socialProviders.*`.

## Deprecation and compatibility policy

- Stable root exports follow semantic versioning:
  - Patch: bug fixes only, no intentional breaking API changes.
  - Minor: additive changes; existing stable exports remain compatible.
  - Major: breaking changes allowed with migration documentation.
- Experimental exports may change in minor releases.
- Deprecation process:
  1. Mark export/path as deprecated in docs and changelog.
  2. Keep compatibility for at least one minor release when feasible.
  3. Remove in next major release unless urgent security/runtime constraints require faster action.
- Release process and compatibility maintenance details are defined in `docs/release-policy.md`.
- Consumer guidance:
  - Prefer root exports over subpaths.
  - Avoid deep imports into `src/`, `db/`, `lib/`, `endpoints/`, and other internals.

## Known gaps and follow-up items

These items are intentionally tracked as follow-up work and are not changed silently in this issue:

1. Add a dedicated deprecated compatibility note in package metadata for `lytx/db/durable/siteDurableObject` and document removal target version.
2. Add CI checks that block new deep-import usage in docs/examples (only `lytx` and documented subpaths allowed).
3. Revisit whether `lytx/worker` should be promoted to stable or deprecated in favor of `createLytxApp` on the root API.
