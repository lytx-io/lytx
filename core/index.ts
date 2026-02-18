// ---------------------------------------------------------------------------
// Lytx Kit – Core Library
// ---------------------------------------------------------------------------
// Re-exports every building block from the analytics platform so consumers
// can import only what they need and compose their own worker / app.
//
//   import { DashboardPage, eventsApi, authMiddleware } from "@lytx/core";
//
// The package does not export one static fetch/queue handler singleton.
// Consumers can either call `createLytxApp(...)` or wire up their own
// `defineApp` using whichever routes, pages, and middleware they choose.
// ---------------------------------------------------------------------------

// ── Pages (public / unauthenticated) ────────────────────────────────────────
export { Home } from "./src/pages/Home";
export { GetStarted } from "./src/pages/GetStarted";
export { PrivacyPolicy } from "./src/pages/PrivacyPolicy";
export { TermsOfService } from "./src/pages/TermsOfService";
export { Signup } from "./src/pages/Signup";
export { Login } from "./src/pages/Login";
export { VerifyEmail } from "./src/pages/VerifyEmail";

// ── App pages (authenticated) ───────────────────────────────────────────────
export { DashboardPage } from "./src/app/Dashboard";
export type { DashboardPageProps } from "./src/app/Dashboard";
export { EventsPage } from "./src/app/Events";
export { ExplorePage } from "./src/app/Explore";
export { SettingsPage } from "./src/app/Settings";
export { AppLayout } from "./src/app/Layout";

// ── App components ──────────────────────────────────────────────────────────
export { NewSiteSetup } from "./src/app/components/NewSiteSetup";
export { DashboardWorkspaceLayout } from "./src/app/components/reports/DashboardWorkspaceLayout";
export { ReportBuilderWorkspace } from "./src/app/components/reports/ReportBuilderWorkspace";
export { CustomReportBuilderPage } from "./src/app/components/reports/custom/CustomReportBuilderPage";

// ── Document / shell ────────────────────────────────────────────────────────
export { Document } from "./src/Document";

// ── API route groups ────────────────────────────────────────────────────────
export { eventsApi } from "./src/api/events_api";
export { seedApi } from "./src/api/seed_api";
export { team_dashboard_endpoints } from "./src/api/team_api";
export {
  world_countries,
  getCurrentVisitorsRoute,
  getDashboardDataRoute,
  siteEventsSqlRoute,
  siteEventsSchemaRoute,
} from "./src/api/sites_api";
export { aiChatRoute, aiConfigRoute, aiTagSuggestRoute } from "./src/api/ai_api";
export { resendVerificationEmailRoute, userApiRoutes } from "./src/api/auth_api";
export { eventLabelsApi } from "./src/api/event_labels_api";
export { reportsApi } from "./src/api/reports_api";
export { legacyContainerRoute, newSiteSetup } from "./src/api/tag_api";
export { lytxTag, trackWebEvent } from "./src/api/tag_api_v2";
export { handleQueueMessage } from "./src/api/queueWorker";

// ── Middleware ───────────────────────────────────────────────────────────────
export { authMiddleware, sessionMiddleware } from "./src/api/authMiddleware";

// ── Auth ────────────────────────────────────────────────────────────────────
export { auth } from "./lib/auth";
export type { AuthUserSession } from "./lib/auth";

// ── Route utilities ─────────────────────────────────────────────────────────
export { checkIfTeamSetupSites, onlyAllowGetPost } from "./src/utilities/route_interuptors";

// ── Durable Objects ─────────────────────────────────────────────────────────
export { SyncDurableObject } from "./src/session/durableObject";
export { SiteDurableObject } from "./db/durable/siteDurableObject";

// ── App factory ─────────────────────────────────────────────────────────────
export { createLytxApp } from "./src/worker";
export type { CreateLytxAppConfig } from "./src/worker";

// ── Types ───────────────────────────────────────────────────────────────────
export type { AppContext } from "./src/worker";
export type { DBAdapter, UserRole } from "./db/types";
export type { SitesContext, TeamContext } from "./db/d1/sites";
