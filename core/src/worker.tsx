import { defineApp, type RequestInfo } from "rwsdk/worker";
import { route, render, prefix, layout } from "rwsdk/router";
import type { ExportedHandler } from "cloudflare:workers";
import { Document } from "@/Document";
import { DashboardPage } from "@/app/Dashboard";
import { EventsPage } from "@/app/Events";
import { ExplorePage } from "@/app/Explore";
import { Home } from "@/pages/Home";
import { GetStarted } from "@/pages/GetStarted";
import { PrivacyPolicy } from "@/pages/PrivacyPolicy";
import { TermsOfService } from "@/pages/TermsOfService";
import { AppLayout } from "@/app/Layout";
import { eventsApi } from "@api/events_api";
import { seedApi } from "@api/seed_api";
import { team_dashboard_endpoints } from "@api/team_api";
import { world_countries, getCurrentVisitorsRoute, getDashboardDataRoute, siteEventsSqlRoute, siteEventsSchemaRoute } from "@api/sites_api";
import { aiChatRoute, aiConfigRoute, aiTagSuggestRoute } from "@api/ai_api";
import { resendVerificationEmailRoute, userApiRoutes } from "@api/auth_api";
import { eventLabelsApi } from "@api/event_labels_api";
import { reportsApi } from "@api/reports_api";
import {
  legacyContainerRoute,
  newSiteSetup,
} from "@api/tag_api";
import { lytxTag, trackWebEvent } from "@api/tag_api_v2";
import { authMiddleware, sessionMiddleware } from "@api/authMiddleware";
import { auth } from "@lib/auth";
import { Signup } from "@/pages/Signup";
import { Login } from "@/pages/Login";
import { VerifyEmail } from "@/pages/VerifyEmail";
import { SettingsPage } from "@/app/Settings";
import { NewSiteSetup } from "@/app/components/NewSiteSetup";
import { DashboardWorkspaceLayout } from "@/app/components/reports/DashboardWorkspaceLayout";
import { ReportBuilderWorkspace } from "@/app/components/reports/ReportBuilderWorkspace";
import { CustomReportBuilderPage } from "@/app/components/reports/custom/CustomReportBuilderPage";
import { checkIfTeamSetupSites, onlyAllowGetPost } from "@utilities/route_interuptors";
import type { AuthUserSession } from "@lib/auth";
import type { DBAdapter, UserRole } from "@db/types";
import { IS_DEV } from "rwsdk/constants";
import type { SitesContext, TeamContext } from "@db/d1/sites";
import { handleQueueMessage } from "@/api/queueWorker";
export { SyncDurableObject } from "@/session/durableObject";
export { SiteDurableObject } from "@db/durable/siteDurableObject";

//TODO: Define things on context and create a middleware function where users can set adapters and override defaults
export type AppContext = {
  session: AuthUserSession;
  initial_site_setup: boolean;
  sites: SitesContext | null;
  team: TeamContext;
  blink_id: string;
  user_role: UserRole;
  //Site Events Accounts live in sqlite
  db_adapter: DBAdapter;
};

//PERF: for the lib these need to be passed as options
const tagRouteDbAdapter: DBAdapter = "sqlite";
const tagRouteQueueIngestionEnabled = true;


type AppRequestInfo = RequestInfo<any, AppContext>;

const app = defineApp<AppRequestInfo>([
  ({ request }) => {
    if (IS_DEV) console.log("🔥🔥🔥", request.method, request.url);
  },
  //NOTE: API ROUTES / no component or html rendering
  legacyContainerRoute,
  lytxTag(tagRouteDbAdapter),
  lytxTag(tagRouteDbAdapter, "/lytx.js"),
  trackWebEvent(tagRouteDbAdapter, "/trackWebEvent.v2", { useQueue: tagRouteQueueIngestionEnabled }),
  trackWebEvent(tagRouteDbAdapter, "/trackWebEvent", { useQueue: tagRouteQueueIngestionEnabled }),
  eventsApi,
  seedApi,
  route("/api/auth/*", (r) => authMiddleware(r)),
  resendVerificationEmailRoute,
  userApiRoutes,
  render<AppRequestInfo>(Document, [
    route("/", [
      onlyAllowGetPost, () => {
        return <Home />;
      },
    ]),
    route("/signup", [
      onlyAllowGetPost, () => {
        return <Signup />;
      },
    ]),
    route("/get-started", [
      onlyAllowGetPost, () => {
        return <GetStarted />;
      },
    ]),
    route("/privacy", [
      onlyAllowGetPost, () => {
        return <PrivacyPolicy />;
      },
    ]),
    route("/terms", [
      onlyAllowGetPost, () => {
        return <TermsOfService />;
      },
    ]),
    route("/login", [
      onlyAllowGetPost,
      () => {
        return <Login />;
      },
    ]),
    route("/verify-email", [
      onlyAllowGetPost,
      async ({ request }) => {
        const requestId = crypto.randomUUID();
        const url = new URL(request.url);
        const token = url.searchParams.get("token") || "";

        const callbackURL = url.searchParams.get("callbackURL") || undefined;
        const safeCallbackURL =
          callbackURL && callbackURL.startsWith("/") && !callbackURL.includes("://")
            ? callbackURL
            : undefined;

        if (!token) {
          if (IS_DEV) console.warn("Email verification failed: missing token", { requestId });
          return (
            <VerifyEmail
              status={{
                type: "error",
                message:
                  "That verification link is missing a token. Please request a new verification email.",
                callbackURL: safeCallbackURL,
              }}
            />
          );
        }

        try {
          await auth.api.verifyEmail({
            query: {
              token,
            },
          });

          return (
            <VerifyEmail
              status={{
                type: "success",
                message: "Your email has been verified. You can continue.",
                callbackURL: safeCallbackURL,
              }}
            />
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "";
          const normalized = message.toLowerCase();

          const friendlyMessage =
            normalized.includes("token_expired") || normalized.includes("expired")
              ? "That verification link has expired. Please request a new verification email."
              : normalized.includes("invalid_token") || normalized.includes("invalid")
                ? "That verification link is invalid. Please request a new verification email."
                : normalized.includes("user_not_found")
                  ? "We couldn't find an account for that link. Please request a new verification email."
                  : "We couldn't verify your email. Please request a new verification email.";

          if (IS_DEV) console.warn("Email verification failed", {
            requestId,
            error: error instanceof Error ? { name: error.name, message: error.message } : error,
            tokenPresent: Boolean(token),
          });

          return (
            <VerifyEmail
              status={{
                type: "error",
                message: friendlyMessage,
                callbackURL: safeCallbackURL,
              }}
            />
          );
        }
      },
    ]),
    layout(AppLayout, [
      sessionMiddleware,
      //PERF: This API PREFIX REQUIRES AUTHENTICATION
      prefix<"/api", AppRequestInfo>("/api", [
        world_countries,
        getDashboardDataRoute,
        getCurrentVisitorsRoute,
        aiConfigRoute,
        aiChatRoute,
        aiTagSuggestRoute,
        siteEventsSqlRoute,
        siteEventsSchemaRoute,
        eventLabelsApi,
        reportsApi,
        ///api/sites
        //PERF: Add method to api prefix outside of sessionMiddleware loop
        newSiteSetup(),
        team_dashboard_endpoints
      ]),
      onlyAllowGetPost,
      route("/dashboard", [
        checkIfTeamSetupSites,
        ({ request }) => {
          const pathname = new URL(request.url).pathname;
          if (pathname === "/dashboard/") {
            return Response.redirect(new URL("/dashboard", request.url).toString(), 308);
          }
          return <DashboardPage activeReportBuilderItemId="create-report" />;
        },
      ]),
      layout(DashboardWorkspaceLayout, [
        route("/dashboard/reports", [
          ({ request }) => {
            return Response.redirect(new URL("/dashboard/reports/create-report", request.url).toString(), 308);
          },
        ]),
        route("/dashboard/reports/custom/new", [
          checkIfTeamSetupSites,
          ({ request }) => {
            const url = new URL(request.url);
            const template = url.searchParams.get("template");
            return <CustomReportBuilderPage initialTemplate={template} />;
          },
        ]),
        route("/dashboard/reports/custom/*", [
          checkIfTeamSetupSites,
          ({ request }) => {
            const pathname = new URL(request.url).pathname;
            const marker = "/dashboard/reports/custom/";
            const reportUuid = pathname.includes(marker)
              ? decodeURIComponent(pathname.slice(pathname.indexOf(marker) + marker.length))
              : "";

            if (!reportUuid || reportUuid.includes("/") || reportUuid === "new") {
              return Response.redirect(new URL("/dashboard/reports/create-report", request.url).toString(), 308);
            }

            return <CustomReportBuilderPage reportUuid={reportUuid} />;
          },
        ]),
        route("/dashboard/reports/create-report", [
          checkIfTeamSetupSites,
          () => {
            return <ReportBuilderWorkspace activeReportBuilderItemId="create-report" />;
          },
        ]),
        route("/dashboard/reports/create-reference", [
          checkIfTeamSetupSites,
          () => {
            return <ReportBuilderWorkspace activeReportBuilderItemId="create-reference" />;
          },
        ]),
        route("/dashboard/reports/ask-ai", [
          checkIfTeamSetupSites,
          () => {
            return <ReportBuilderWorkspace activeReportBuilderItemId="ask-ai" />;
          },
        ]),
        route("/dashboard/reports/create-dashboard", [
          checkIfTeamSetupSites,
          () => {
            return <ReportBuilderWorkspace activeReportBuilderItemId="create-dashboard" />;
          },
        ]),
        route("/dashboard/reports/create-notification", [
          checkIfTeamSetupSites,
          () => {
            return <ReportBuilderWorkspace activeReportBuilderItemId="create-notification" />;
          },
        ]),
      ]),
      route("/dashboard/events", [
        checkIfTeamSetupSites,
        async () => {
          return <EventsPage />;
        },
      ]),
      route("/dashboard/new-site", [
        () => {
          return <NewSiteSetup />;
        },
      ]),
      route("/dashboard/settings", [
        () => {
          return <SettingsPage />;
        },
      ]),
      route("/dashboard/explore", [
        checkIfTeamSetupSites,
        () => {
          return <ExplorePage />;
        },
      ]),
      route("/admin/events", [
        ({ request }) => {
          return Response.redirect(new URL("/dashboard/events", request.url).toString(), 308);
        },
      ]),
      route("/new-site", [
        ({ request }) => {
          return Response.redirect(new URL("/dashboard/new-site", request.url).toString(), 308);
        },
      ]),
      route("/settings", [
        ({ request }) => {
          return Response.redirect(new URL("/dashboard/settings", request.url).toString(), 308);
        },
      ]),
      route("/explore", [
        ({ request }) => {
          return Response.redirect(new URL("/dashboard/explore", request.url).toString(), 308);
        },
      ]),
    ]),

    //NOTE: Put anything thats not a get above this
    // route("/:page", async ({ params, request }) => {
    //   //TODO: Add 404 page
    //   if (request.method != "GET")
    //     return new Response("Not Found.", { status: 404 });
    //
    //   const content = await blink.getContentItem(params.page, "html");
    //
    //   if (content.status != "Published") {
    //     return new Response("Not Found.", { status: 404 });
    //   }
    //
    //   return <Page content={content.body} />;
    // }),
  ]),
]);

export default {
  fetch: app.fetch,
  queue: handleQueueMessage,
} satisfies ExportedHandler<Env>;
