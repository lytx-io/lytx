import type { FC, ReactElement } from "react";
import type { RequestInfo } from "rwsdk/worker";
import type { DocumentProps, Route } from "rwsdk/router";
import type {
  BrowserData,
  DashboardResponseData,
  DeviceGeoData,
  NivoBarChartData,
  NivoLineChartData,
  NivoPieChartData,
  TopSourcesData,
} from "../../db/tranformReports";
import type { getDashboardDataCore } from "../api/sites_api";

type Awaitable<T> = T | Promise<T>;

export type LytxRouteOverrideResult = Awaitable<Response | ReactElement>;

export type LytxUserRole = "viewer" | "editor" | "admin";
export type LytxDbAdapter = "sqlite" | "postgres" | "singlestore" | "analytics_engine";

export type LytxSiteContext = {
  site_id: number;
  name: string | null;
  tag_id: string;
  domain: string | null;
  createdAt: Date;
  updatedAt: Date | null;
};

export type LytxTeamContext = {
  id: number | string;
  name: string | null;
  external_id: number | string | null;
};

export type LytxSessionContext = {
  session: {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    expiresAt: Date;
    token: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  };
  user: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    image?: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  initial_site_setup: boolean;
  email_verified: boolean;
  team: LytxTeamContext;
  all_teams: LytxTeamContext[];
  role: LytxUserRole;
  db_adapter: LytxDbAdapter;
  userSites: LytxSiteContext[] | undefined;
  timezone: string | null;
  last_site_id: number | null;
  last_team_id: number | null;
};

export type LytxRouteContext = {
  session: LytxSessionContext;
  initial_site_setup: boolean;
  sites: LytxSiteContext[] | null;
  team: LytxTeamContext;
  blink_id: string;
  user_role: LytxUserRole;
  db_adapter: LytxDbAdapter;
};

export type LytxRouteRequestInfo<TPath extends string> = RequestInfo<TPath, LytxRouteContext>;

export type LytxToolbarSiteOption = {
  site_id: number;
  name: string;
  tag_id: string;
};

export type LytxReportBuilderActionId =
  | "create-report"
  | "create-reference"
  | "ask-ai"
  | "create-dashboard"
  | "create-notification";

export type LytxReportBuilderMenuActiveId =
  | LytxReportBuilderActionId
  | `custom-report:${string}`;

export type LytxDashboardReportData = {
  PageViewsData?: NivoLineChartData;
  ReferrersData?: NivoPieChartData;
  EventTypesData?: DashboardResponseData["EventTypesData"];
  DeviceGeoData?: DeviceGeoData;
  TopPagesData?: NivoBarChartData;
  TopSourcesData?: TopSourcesData;
  BrowserData?: BrowserData;
  EventSummary?: DashboardResponseData["EventSummary"];
  initialDashboardData?: DashboardResponseData | null;
};

export type LytxDashboardDefaultProps = {
  activeReportBuilderItemId?: LytxReportBuilderMenuActiveId;
  reportBuilderEnabled?: boolean;
  askAiEnabled?: boolean;
  settingsEnabled?: boolean;
  initialToolbarSites?: LytxToolbarSiteOption[];
  initialToolbarSiteId?: number | null;
  initialDashboardDateRange?: {
    start: string;
    end: string;
    preset: "Today";
  };
  initialTimezone?: string | null;
  reportData: LytxDashboardReportData;
};

export type LytxGetDashboardDataCore = typeof getDashboardDataCore;

export type LytxDashboardRouteUiOverrideArgs = {
  info: LytxRouteRequestInfo<"/dashboard">;
  /**
   * Default dashboard props from core. Report payloads are grouped under
   * `defaultProps.reportData` so consumers can override non-data props
   * independently from fetched report data.
   */
  defaultProps: LytxDashboardDefaultProps;
  toolbarState: {
    initialSites: LytxToolbarSiteOption[];
    initialSiteId: number | null;
  };
  helpers: {
    getDashboardDataCore: LytxGetDashboardDataCore;
  };
};

export type LytxEventsRouteUiOverrideArgs = {
  info: LytxRouteRequestInfo<"/dashboard/events">;
};

export type LytxExploreRouteUiOverrideArgs = {
  info: LytxRouteRequestInfo<"/dashboard/explore">;
  defaultProps: {
    initialSites: LytxToolbarSiteOption[];
    initialSiteId: number | null;
  };
};

/**
 * Additional RedwoodSDK route entry accepted by `createLytxApp({ routes })`.
 *
 * Use `route(...)`, `layout(...)`, `prefix(...)`, `except(...)`, or middleware
 * values from `rwsdk/router` and pass them in `routes.additionalRoutes`.
 */
export type LytxAdditionalRoute = Route;

/**
 * Custom RedwoodSDK Document component used by `render(...)`.
 *
 * Override this to replace core's default `Document` wrapper.
 */
export type LytxDocumentComponent = FC<DocumentProps>;

/**
 * Route-level UI override hooks for `createLytxApp({ routes: { ui } })`.
 *
 * Read the `/api` docs before replacing a route UI so your custom page calls
 * the same fetch helpers/methods expected by core.
 */
export type LytxRouteUiOverrides = {
  /**
   * Override `/dashboard` rendering.
   *
   * Read the `/api` docs first; dashboard UI depends on dashboard data helpers
   * and API contracts that core calls by default.
   */
  dashboard?: (args: LytxDashboardRouteUiOverrideArgs) => LytxRouteOverrideResult;
  /**
   * Override `/dashboard/events` rendering.
   *
   * Read the `/api` docs first; events UI depends on event fetch methods and
   * API contracts provided by core.
   */
  events?: (args: LytxEventsRouteUiOverrideArgs) => LytxRouteOverrideResult;
  /**
   * Override `/dashboard/explore` rendering.
   *
   * Read the `/api` docs first; explore UI depends on query helpers and API
   * contracts provided by core.
   */
  explore?: (args: LytxExploreRouteUiOverrideArgs) => LytxRouteOverrideResult;
};

/**
 * Route override configuration for `createLytxApp({ routes })`.
 *
 * This is intended to override core's default route UI while preserving
 * the built-in route tree and middleware.
 */
export type LytxRoutesConfig = {
  /**
   * Custom RedwoodSDK Document component for the app render wrapper.
   *
   * Use this to replace core `Document` with your own component.
   */
  document?: LytxDocumentComponent;
  /**
   * Additional RedwoodSDK routes appended to the core worker route tree.
   *
   * Use this when you need to register extra app routes beyond core defaults.
   */
  additionalRoutes?: readonly LytxAdditionalRoute[];
  ui?: LytxRouteUiOverrides;
};
