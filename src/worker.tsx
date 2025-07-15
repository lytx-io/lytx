import { defineApp, type RequestInfo } from "rwsdk/worker";
import { route, render, prefix, layout } from "rwsdk/router";
import { Document } from "@/Document";
import { DashboardPage } from "@/app/Dashboard";
import { EventsPage } from "@/app/Events";
import { Home } from "@/pages/Home";
import { AppLayout } from "@/app/Layout";
import { lytxTag, trackWebEvent, newSiteSetup } from "@api/tag_api";
import { eventsApi } from "@api/events_api";
import { authMiddleware, sessionMiddleware } from "@api/authMiddleware";
import { Signup } from "@/pages/Signup";
import { Login } from "@/pages/Login";
import { SettingsPage } from "@/app/Settings";
import { NewSiteSetup } from "@/app/components/NewSiteSetup";
import type { DBAdapter } from "@db/d1/schema";
import type { AuthUserSession } from "@lib/auth";
import { world_countries, getDashboardDataRoute } from "@api/sites_api";
import { team_dashboard_endpoints } from "@api/team_api";
import { checkIfTeamSetupSites, onlyAllowGetPost } from "@utilities/route_interuptors";
import { IS_DEV } from "rwsdk/constants";


export { SyncDurableObject } from "@/session/durableObject";

export type AppContext = {
  session: AuthUserSession;
  initial_site_setup: boolean;
  sites: Array<any> | null;
  team: number;
  blink_id: string;
  db_adapter: DBAdapter;
};



//TODO:Export the routes for defineApp
export default defineApp<RequestInfo<any, AppContext>>([
  ({ request }) => {
    if (IS_DEV) console.log("🔥🔥🔥", request.method, request.url);
  },
  //NOTE: API ROUTES / no component or html rendering
  //TODO: pass db provider as prop from ctx? or initial config
  lytxTag("sqlite"),
  trackWebEvent("sqlite"),
  eventsApi,
  route("/api/auth/*", (r) => authMiddleware(r)),
  render(Document, [
    route("/", [onlyAllowGetPost, async () => {
      return <Home />;
    }]),
    route("/signup", [onlyAllowGetPost, () => {
      return <Signup />;
    }]),
    route("/login", [onlyAllowGetPost, () => {
      return <Login />;
    }]),
    layout(AppLayout, [
      route("/signup", [onlyAllowGetPost, () => {
        return <Signup />;
      }]),
      route("/login", [onlyAllowGetPost, () => {
        return <Login />;
      }]),
      sessionMiddleware,
      prefix("/api", [
        world_countries,
        getDashboardDataRoute,
        ///api/sites
        newSiteSetup,
      ]),
      onlyAllowGetPost,
      route("/admin/events", [checkIfTeamSetupSites, async () => {
        return <EventsPage />;
      }]),
      route("/new-site", [() => {
        return <NewSiteSetup />;
      }]),
      route("/settings", [
        () => {
          return <SettingsPage />;
        },
      ]),
      route("/dashboard", [checkIfTeamSetupSites, () => {
        return <DashboardPage />;
      }]),
    ]),
  ]),
]);
