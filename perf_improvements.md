# Performance Improvements Plan

This list is based on a review of `@core` and how `@demo` consumes it. `@demo` has minimal React logic; most perf work is in `@core`.

## Priority Legend

- P0 = highest impact, do first
- P1 = medium impact
- P2 = lower impact / cleanup

---

## P0 - React Query + Network Churn

### 1) Restore sane React Query cache defaults

**Files to modify**

- `core/src/app/providers/QueryProvider.tsx`
- `core/src/app/components/reports/DashboardToolbar.tsx`
- `core/src/app/Settings.tsx`
- `core/src/app/components/charts/ChartComponents.tsx`

**Changes needed**

- In `QueryProvider`, replace global `staleTime: 0` and `gcTime: 0` with non-zero defaults (for example `staleTime: 30_000` and `gcTime: 5 * 60_000`).
- Add explicit per-query overrides only where true realtime behavior is needed.
- In `DashboardToolbar` and `Settings`, remove `staleTime: 0`/`gcTime: 0` overrides unless absolutely required.
- Keep `CurrentVisitors` polling, but make it explicit that only this query should be highly aggressive.

---

### 2) Debounce expensive event table searches

**Files to modify**

- `core/src/app/Events.tsx`

**Changes needed**

- Split `searchTerm` into:
  - immediate input state, and
  - debounced value used by `useQuery` key/payload.
- Reset pagination from debounced filters (not every keypress).
- Ensure the query key uses debounced search value.

---

### 3) Prevent unnecessary filter state updates in dashboard

**Files to modify**

- `core/src/app/Dashboard.tsx`

**Changes needed**

- In the site sync `useEffect`, avoid calling `setFilters` when `siteId` is already equal to the computed value.
- Keep query key stability by avoiding no-op state writes.

---

## P0 - Consolidate Requests

### 4) Combine dashboard metrics + event labels into one API response

**Files to modify**

- `core/src/api/sites_api.ts`
- `core/db/tranformReports.ts`
- `core/src/app/Dashboard.tsx`
- `core/src/app/Events.tsx`

**Changes needed**

- Extend `/api/dashboard/data` response to optionally include event labels (for selected site).
- Add/extend response type in `tranformReports.ts` to include labels.
- Remove separate `/api/event-labels` query from `Dashboard` when labels are available in dashboard response.
- Reuse same payload path in `Events` where possible to reduce duplicate requests.

---

### 5) Batch custom report widget data requests

**Files to modify**

- `core/src/api/sites_api.ts`
- `core/db/durable/siteDurableObject.ts`
- `core/db/durable/durableObjectClient.ts`
- `core/src/app/components/reports/custom/CustomReportBuilderPage.tsx`

**Changes needed**

- Add a batch SQL endpoint (single request with multiple widget queries).
- Add Durable Object RPC method to execute multiple validated read-only queries in one call.
- Replace `useQueries` per-widget fetch pattern in `CustomReportBuilderPage` with one batched `useQuery`.
- Map batched results back to widget IDs.

---

## P0 - Backend Query Count + SQL Efficiency

### 6) Merge dashboard aggregate + event summary backend work

**Files to modify**

- `core/db/durable/siteDurableObject.ts`
- `core/db/durable/durableObjectClient.ts`
- `core/src/api/sites_api.ts`

**Changes needed**

- Create one Durable Object method that returns both:
  - dashboard aggregates, and
  - event summary/pagination.
- Share filter parsing and reduce repeated table scans.
- Update API route to call the new single method rather than two separate RPC calls.

---

### 7) Add indexes for current query patterns

**Files to modify**

- `core/db/durable/migrations/0001_perf_indexes.sql` (new)
- `core/db/durable/migrations/migrations.js`
- `core/db/durable/migrations/meta/_journal.json`
- `core/db/d1/schema.ts`

**Changes needed**

- Add indexes aligned to observed filters/grouping in dashboard and events, especially for:
  - `rid`
  - `client_page_url`
  - `city`
  - `region`
  - `browser`
  - `operating_system`
  - composite indexes for high-frequency combinations used by summary/filter queries.
- Keep schema and durable migration artifacts in sync.

---

### 8) Make widget SQL predicates index-friendly

**Files to modify**

- `core/src/app/components/reports/custom/buildWidgetSql.ts`

**Changes needed**

- Remove/limit `COALESCE(CAST(...))` wrappers in equality predicates where they block index usage.
- Generate direct column comparisons for known text columns when possible.
- Keep SQL injection protections and identifier sanitization unchanged.

---

## P1 - Duplicate/Unnecessary Fetches

### 9) Remove duplicate schema fetch in SQL editor flow

**Files to modify**

- `core/src/app/components/SQLEditor.tsx`
- `core/src/app/Explore.tsx`
- `core/src/app/components/reports/custom/CustomReportBuilderPage.tsx`

**Changes needed**

- Use a shared schema query source (single cached query per site) instead of separate fetches in both editor and schema viewer contexts.
- Ensure schema requests are keyed by `siteId` and reuse React Query cache.

---

### 10) Reduce extra report-fetch roundtrip in toolbar

**Files to modify**

- `core/src/app/components/reports/DashboardToolbar.tsx`

**Changes needed**

- Avoid secondary fetch for active custom report when list query already includes that report.
- Keep fallback fetch only when required (deep link not in current list response).

---

## P1 - Hook Hygiene / Render Stability

### 11) Tighten `useEffect` dependencies causing avoidable reruns

**Files to modify**

- `core/src/app/Settings.tsx`
- `core/src/app/providers/AuthProvider.tsx`

**Changes needed**

- In `TeamSettings`, change effect deps from broad `props` object to specific values (for example `apiData`, `props.onApiDataLoad`).
- Remove/guard dev-only effects that produce extra render-side work/noise.

---

## P2 - Validation and Measurement

### 12) Add lightweight timing/instrumentation around hot endpoints

**Files to modify**

- `core/src/api/sites_api.ts`
- `core/db/durable/siteDurableObject.ts`

**Changes needed**

- Add timing logs/metrics for:
  - `/api/dashboard/data`
  - `/api/site-events/query`
  - durable methods used by dashboard and events.
- Include request ID and timing buckets to confirm improvements after rollout.

---

## Demo-Specific Note

- No immediate perf code changes required in:
  - `demo/src/worker.tsx`
  - `demo/src/client.tsx`
  - `demo/src/Document.tsx`
- Main benefit to `@demo` comes from `@core` fixes above.
