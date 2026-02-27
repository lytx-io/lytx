import type { ReactElement } from "react";
import type { RequestInfo } from "rwsdk/worker";
import type { DashboardPageProps } from "../app/Dashboard";
import type { DashboardResponseData } from "../../db/tranformReports";
import type { getDashboardDataCore } from "../api/sites_api";
import type { AppContext } from "../types/app-context";

type Awaitable<T> = T | Promise<T>;

export type LytxRouteOverrideResult = Awaitable<Response | ReactElement>;

export type LytxRouteContext = AppContext;
export type LytxUserRole = LytxRouteContext["user_role"];
export type LytxDbAdapter = LytxRouteContext["db_adapter"];
export type LytxSessionContext = LytxRouteContext["session"];
export type LytxTeamContext = LytxRouteContext["team"];
export type LytxSiteContext = NonNullable<LytxRouteContext["sites"]>[number];

export type LytxRouteRequestInfo<TPath extends string> = RequestInfo<TPath, LytxRouteContext>;

export type LytxToolbarSiteOption = {
  site_id: number;
  name: string;
  tag_id: string;
};

export type LytxDashboardDefaultProps = DashboardPageProps;
export type LytxGetDashboardDataCore = typeof getDashboardDataCore;

export type LytxDashboardRouteUiOverrideArgs = {
  info: LytxRouteRequestInfo<"/dashboard">;
  defaultProps: LytxDashboardDefaultProps;
  toolbarState: {
    initialSites: LytxToolbarSiteOption[];
    initialSiteId: number | null;
  };
  initialDashboardData: DashboardResponseData | null;
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
  ui?: LytxRouteUiOverrides;
};
