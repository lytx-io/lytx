# `@lytx/core` OSS Contract

This document defines the supported public API contract for `@lytx/core`.

If an import path or behavior is not listed here as supported, treat it as internal and subject to change without notice.

## Scope and intent

- The stable integration model is composition: consumers assemble their own `defineApp(...)` worker from root exports.
- The package root (`@lytx/core`) is the canonical public entrypoint.
- Non-root subpath exports may exist for compatibility and migration, but are explicitly categorized below.

## Supported public exports (stable)

The following are supported under semantic versioning guarantees (see policy below) when imported from `@lytx/core`.

### Pages and shells

- `Document`
- `Home`, `GetStarted`, `PrivacyPolicy`, `TermsOfService`
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

- `authMiddleware`, `sessionMiddleware`
- `auth`
- `checkIfTeamSetupSites`, `onlyAllowGetPost`
- `SyncDurableObject`, `SiteDurableObject`
- `DashboardPageProps`, `AuthUserSession`, `AppContext`, `DBAdapter`, `UserRole`, `SitesContext`, `TeamContext`

## Supported public exports (experimental / unstable)

These are allowed for consumers but may change in minor releases and may be removed after deprecation notice.

- `@lytx/core/worker`
  - Pre-wired worker bundle for turnkey usage.
  - Intended for fast start and compatibility, not long-term pinned integrations.
- `@lytx/core/db/durable/siteDurableObject`
  - Legacy typed subpath export.
  - Prefer `SiteDurableObject` from `@lytx/core`.

## Internal/private modules (not supported)

The following are not supported for external consumers and can change at any time:

- Any deep import not listed above, including paths like:
  - `@lytx/core/src/*`
  - `@lytx/core/db/*` (except `@lytx/core/db/durable/siteDurableObject`, which is experimental)
  - `@lytx/core/lib/*`
  - `@lytx/core/endpoints/*`
  - `@lytx/core/cli/*`
  - `@lytx/core/public/*`
  - `@lytx/core/vite/*`
- Internal file layout, route implementation details, and schema internals.

## Supported extension and customization points

### Feature flags

- `REPORT_BUILDER`: enables report-builder routes and UI.
- `ASK_AI`: toggles Ask AI surfaces when report builder is enabled.

### Resource naming and bindings

The contract supports configuring and binding these Cloudflare resources in consumer workers:

- D1: `lytx_core_db`
- KV: `LYTX_EVENTS`, `lytx_config`, `lytx_sessions`
- Queue: `SITE_EVENTS_QUEUE`
- Durable Object namespace: `SITE_DURABLE_OBJECT`

Consumers may choose deployment-level names, but the runtime bindings exposed to the worker must match the expected binding keys above.

### Domain and environment configuration

- `LYTX_DOMAIN` is the supported domain-facing configuration variable.
- Auth and integration behavior are configured via documented env vars in `README.md`.

### Composition and routing

- Consumers can mount exported routes under custom prefixes (`prefix("/analytics", [...])`).
- Consumers can include/exclude route groups and pages by composing exports into their own worker.
- Consumers can layer additional middleware before/after provided middleware.

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
- Consumer guidance:
  - Prefer root exports over subpaths.
  - Avoid deep imports into `src/`, `db/`, `lib/`, `endpoints/`, and other internals.

## Known gaps and follow-up items

These items are intentionally tracked as follow-up work and are not changed silently in this issue:

1. Add a dedicated deprecated compatibility note in package metadata for `@lytx/core/db/durable/siteDurableObject` and document removal target version.
2. Add CI checks that block new deep-import usage in docs/examples (only `@lytx/core` and documented subpaths allowed).
3. Revisit whether `@lytx/core/worker` should be promoted to stable or deprecated in favor of the composition-first root API.
