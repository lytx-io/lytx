import { defineApp } from "rwsdk/worker";
import { route, render, prefix, layout } from "rwsdk/router";
import { Document } from "@/Document";
import { DashboardPage } from "@/app/Dashboard";
import { EventsPage } from "@/app/Events";
import { ExplorePage } from "@/app/Explore";
import { AppLayout } from "@/app/Layout";
import { eventsApi } from "@api/events_api";
import { seedApi } from "@api/seed_api";
import { team_dashboard_endpoints } from "@api/team_api";
import { world_countries, getCurrentVisitorsRoute, getDashboardDataCore, getDashboardDataRoute, siteEventsSqlRoute, siteEventsSchemaRoute } from "@api/sites_api";
import { aiChatRoute, aiConfigRoute, aiTagSuggestRoute, getAiConfig, setAiRuntimeOverrides } from "@api/ai_api";
import { resendVerificationEmailRoute, userApiRoutes } from "@api/auth_api";
import { eventLabelsApi } from "@api/event_labels_api";
import { reportsApi } from "@api/reports_api";
import {
  legacyContainerRoute,
  newSiteSetup,
} from "@api/tag_api";
import { lytxTag, trackWebEvent } from "@api/tag_api_v2";
import { authMiddleware, sessionMiddleware } from "@api/authMiddleware";
import {
  canRegisterEmail,
  getAuth,
  getAuthProviderAvailability,
  isPublicSignupOpen,
  setAuthRuntimeConfig,
} from "@lib/auth";
import { Signup } from "@/pages/Signup";
import { Login } from "@/pages/Login";
import { VerifyEmail } from "@/pages/VerifyEmail";
import { SettingsPage } from "@/app/Settings";
import { NewSiteSetup } from "@/app/components/NewSiteSetup";
import { DashboardWorkspaceLayout } from "@/app/components/reports/DashboardWorkspaceLayout";
import { ReportBuilderWorkspace } from "@/app/components/reports/ReportBuilderWorkspace";
import { CustomReportBuilderPage } from "@/app/components/reports/custom/CustomReportBuilderPage";
import { checkIfTeamSetupSites, onlyAllowGetPost } from "@utilities/route_interuptors";
import type { DBAdapter } from "@db/types";
import { IS_DEV } from "rwsdk/constants";
import type { AppContext, AppRequestInfo } from "@/types/app-context";
import { handleQueueMessage } from "@/api/queueWorker";
import {
  isAiFeatureEnabled,
  isAskAiEnabled,
  isAuthEnabled,
  isDashboardEnabled,
  isEventsEnabled,
  isReportBuilderEnabled,
  isTagScriptEnabled,
} from "@/lib/featureFlags";
import { parseCreateLytxAppConfig } from "@/config/createLytxAppConfig";
import type { CreateLytxAppConfig } from "@/config/createLytxAppConfig";
import { setEmailFromAddress } from "@lib/sendMail";
import type { DashboardResponseData } from "@db/tranformReports";
import { parseDateParam } from "@/utilities/dashboardParams";
import { getTeamSettings } from "@db/d1/teams";
import { d1_client } from "@db/d1/client";
import { user } from "@db/d1/schema";
import { eq } from "drizzle-orm";
export { SyncDurableObject } from "@/session/durableObject";
export { SiteDurableObject } from "@db/durable/siteDurableObject";

//TODO: Define things on context and create a middleware function where users can set adapters and override defaults
export type { AppContext };
export type { CreateLytxAppConfig } from "@/config/createLytxAppConfig";

const DEFAULT_TAG_DB_ADAPTER: DBAdapter = "sqlite";
const DEFAULT_TAG_SCRIPT_PATH = "/lytx.v2.js";
const DEFAULT_LEGACY_TAG_SCRIPT_PATH = "/lytx.js";
const DEFAULT_TRACK_WEB_EVENT_PATH = "/trackWebEvent.v2";
const DEFAULT_LEGACY_TRACK_WEB_EVENT_PATH = "/trackWebEvent";

const normalizeRoutePrefix = (value?: string): string => {
  if (!value) return "";
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed === "/") return "";
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
};

const withRoutePrefix = (prefix: string, routePath: string): string => {
  if (!prefix) return routePath;
  if (routePath === prefix || routePath.startsWith(`${prefix}/`)) return routePath;
  const normalizedPath = routePath.startsWith("/") ? routePath : `/${routePath}`;
  return `${prefix}${normalizedPath}`;
};

type ToolbarSiteOption = {
  site_id: number;
  name: string;
  tag_id: string;
};

const getInitialToolbarState = (ctx: AppContext) => {
  const initialSites: ToolbarSiteOption[] = (ctx.sites ?? []).map((site) => ({
    site_id: site.site_id,
    name: site.name || `Site ${site.site_id}`,
    tag_id: site.tag_id,
  }));

  const preferredSiteId = ctx.session?.last_site_id ?? null;
  const initialSiteId = initialSites.some((site) => site.site_id === preferredSiteId)
    ? preferredSiteId
    : (initialSites[0]?.site_id ?? null);

  return {
    initialSites,
    initialSiteId,
  };
};

const resolvePreferredTimeZone = (value: unknown): string => {
  if (typeof value !== "string" || value.trim().length === 0) return "UTC";
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value.trim() });
    return value.trim();
  } catch {
    return "UTC";
  }
};

const resolveUserTimeZoneForServerRender = async (
  ctx: AppContext,
  fallbackTimeZone?: unknown,
): Promise<string> => {
  try {
    const dbUser = await d1_client
      .select({ timezone: user.timezone })
      .from(user)
      .where(eq(user.id, ctx.session.user.id))
      .limit(1);

    if (dbUser[0]?.timezone) {
      return resolvePreferredTimeZone(dbUser[0].timezone);
    }
  } catch (error) {
    if (IS_DEV) {
      console.log("🔥🔥🔥 failed to resolve user timezone for server render", error);
    }
  }

  const sessionTimeZone = ctx.session?.timezone;
  const candidate =
    typeof sessionTimeZone === "string" && sessionTimeZone.trim().length > 0
      ? sessionTimeZone
      : fallbackTimeZone;

  return resolvePreferredTimeZone(candidate);
};

const getDateStringInTimeZone = (date: Date, timeZone: string): string => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
};

const appRoute = <TPath extends string>(
  path: TPath,
  handlers: Parameters<typeof route<TPath, AppRequestInfo>>[1],
) => route<TPath, AppRequestInfo>(path, handlers);

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const isEmailSignupRequest = (request: Request): boolean => {
  if (request.method !== "POST") return false;
  const url = new URL(request.url);
  return url.pathname === "/api/auth/sign-up/email";
};

const readSignupEmail = async (request: Request): Promise<string> => {
  try {
    const body = await request.clone().json();
    if (!isRecord(body) || typeof body.email !== "string") return "";
    return body.email;
  } catch {
    return "";
  }
};

const buildSignupClosedResponse = (): Response => {
  return new Response(
    JSON.stringify({
      code: "SIGNUP_REQUIRES_INVITE",
      message: "Public sign up is disabled. Ask an admin for an invitation.",
    }),
    {
      status: 403,
      headers: { "Content-Type": "application/json" },
    },
  );
};

export function createLytxApp(config: CreateLytxAppConfig = {}) {
  const parsed_config = parseCreateLytxAppConfig(config);
  setAuthRuntimeConfig(parsed_config.auth);
  setEmailFromAddress(parsed_config.env?.EMAIL_FROM);
  setAiRuntimeOverrides({
    apiKey: parsed_config.ai?.apiKey ?? parsed_config.env?.AI_API_KEY,
    accountId: parsed_config.ai?.accountId ?? parsed_config.env?.AI_ACCOUNT_ID,
    model: parsed_config.ai?.model ?? parsed_config.env?.AI_MODEL,
    baseURL: parsed_config.ai?.baseURL ?? parsed_config.env?.AI_BASE_URL,
    provider: parsed_config.ai?.provider ?? parsed_config.env?.AI_PROVIDER,
  });
  const authProviders = getAuthProviderAvailability();
  const emailPasswordEnabled = parsed_config.auth?.emailPasswordEnabled ?? true;
  if (!emailPasswordEnabled && !authProviders.google && !authProviders.github) {
    throw new Error("Invalid auth configuration: at least one auth method must be enabled");
  }
  const enableRequestLogging = parsed_config.enableRequestLogging ?? IS_DEV;
  const authEnabled = parsed_config.features?.auth ?? isAuthEnabled();
  const dashboardEnabled = authEnabled && (parsed_config.features?.dashboard ?? isDashboardEnabled());
  const eventsEnabled = parsed_config.features?.events ?? isEventsEnabled();
  const aiEnabled = dashboardEnabled && (parsed_config.features?.ai ?? isAiFeatureEnabled());
  const tagScriptEnabled = parsed_config.features?.tagScript ?? isTagScriptEnabled();
  const tagRouteDbAdapter = parsed_config.db?.dbAdapter ?? parsed_config.dbAdapter ?? DEFAULT_TAG_DB_ADAPTER;
  const tagRouteEventStore = parsed_config.db?.eventStore ?? "durable_objects";
  const tagRouteQueueIngestionEnabled = parsed_config.useQueueIngestion ?? (tagRouteEventStore === "durable_objects");
  const includeLegacyTagRoutes = parsed_config.includeLegacyTagRoutes ?? true;
  const trackingRoutePrefix = normalizeRoutePrefix(parsed_config.trackingRoutePrefix);
  const tagScriptPath = withRoutePrefix(
    trackingRoutePrefix,
    parsed_config.tagRoutes?.scriptPath ?? DEFAULT_TAG_SCRIPT_PATH,
  );
  const legacyTagScriptPath = withRoutePrefix(
    trackingRoutePrefix,
    parsed_config.tagRoutes?.legacyScriptPath ?? DEFAULT_LEGACY_TAG_SCRIPT_PATH,
  );
  const trackWebEventPath = withRoutePrefix(
    trackingRoutePrefix,
    parsed_config.tagRoutes?.eventPath ?? DEFAULT_TRACK_WEB_EVENT_PATH,
  );
  const legacyTrackWebEventPath = withRoutePrefix(
    trackingRoutePrefix,
    parsed_config.tagRoutes?.legacyEventPath ?? DEFAULT_LEGACY_TRACK_WEB_EVENT_PATH,
  );
  const reportBuilderEnabled =
    dashboardEnabled && (parsed_config.features?.reportBuilderEnabled ?? isReportBuilderEnabled());
  const askAiEnabled =
    aiEnabled && (parsed_config.features?.askAiEnabled ?? (reportBuilderEnabled && isAskAiEnabled()));

  const tagRoutes: Array<
    typeof legacyContainerRoute | ReturnType<typeof lytxTag> | ReturnType<typeof trackWebEvent>
  > = [];

  if (includeLegacyTagRoutes && tagScriptEnabled) {
    tagRoutes.push(legacyContainerRoute);
  }

  if (tagScriptEnabled) {
    tagRoutes.push(lytxTag(tagRouteDbAdapter, tagScriptPath));
  }

  if (eventsEnabled) {
    tagRoutes.push(trackWebEvent(tagRouteDbAdapter, trackWebEventPath, { useQueue: tagRouteQueueIngestionEnabled }));
  }

  if (includeLegacyTagRoutes) {
    if (tagScriptEnabled && legacyTagScriptPath !== tagScriptPath) {
      tagRoutes.push(lytxTag(tagRouteDbAdapter, legacyTagScriptPath));
    }
    if (eventsEnabled && legacyTrackWebEventPath !== trackWebEventPath) {
      tagRoutes.push(
        trackWebEvent(tagRouteDbAdapter, legacyTrackWebEventPath, { useQueue: tagRouteQueueIngestionEnabled }),
      );
    }
  }

  const app = defineApp<AppRequestInfo>([
    ({ request }) => {
      if (enableRequestLogging) console.log("🔥🔥🔥", request.method, request.url);
    },
    //NOTE: API ROUTES / no component or html rendering
    ...tagRoutes,
    ...(eventsEnabled ? [eventsApi] : []),
    seedApi,
    ...(authEnabled
      ? [
        route("/api/auth/*", async (r) => {
          if (isEmailSignupRequest(r.request)) {
            const signupEmail = await readSignupEmail(r.request);
            const allowed = await canRegisterEmail(signupEmail);
            if (!allowed) {
              return buildSignupClosedResponse();
            }
          }
          return authMiddleware(r);
        }),
        resendVerificationEmailRoute,
        userApiRoutes,
      ]
      : []),
    render<AppRequestInfo>(Document, [
      route("/", [
        onlyAllowGetPost, ({ request }) => {
          return Response.redirect(new URL("/login", request.url).toString(), 308);
        },
      ]),
      ...(authEnabled
        ? [
            route("/signup", [
              onlyAllowGetPost, async () => {
                const publicSignupOpen = await isPublicSignupOpen();
                return (
                  <Signup
                    authProviders={authProviders}
                    emailPasswordEnabled={emailPasswordEnabled}
                    publicSignupOpen={publicSignupOpen}
                  />
                );
              },
            ]),
        ]
        : []),
      ...(authEnabled
        ? [
            route("/login", [
              onlyAllowGetPost,
              async () => {
                const allowSignupLink = await isPublicSignupOpen();
                return (
                  <Login
                    authProviders={authProviders}
                    emailPasswordEnabled={emailPasswordEnabled}
                    allowSignupLink={allowSignupLink}
                  />
                );
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
                  const auth = getAuth();
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
        ]
        : []),
      ...(dashboardEnabled
        ? [layout(AppLayout, [
          sessionMiddleware,
          //PERF: This API PREFIX REQUIRES AUTHENTICATION
          prefix<"/api", AppRequestInfo>("/api", [
            world_countries,
            getDashboardDataRoute,
            getCurrentVisitorsRoute,
            ...(aiEnabled ? [aiConfigRoute, aiChatRoute, aiTagSuggestRoute] : []),
            siteEventsSqlRoute,
            siteEventsSchemaRoute,
            eventLabelsApi,
            ...(reportBuilderEnabled ? [reportsApi] : []),
            ///api/sites
            //PERF: Add method to api prefix outside of sessionMiddleware loop
            newSiteSetup(),
            team_dashboard_endpoints
          ]),
          onlyAllowGetPost,
          route("/dashboard", [
            checkIfTeamSetupSites,
            async ({ request, ctx }) => {
              const pathname = new URL(request.url).pathname;
              if (pathname === "/dashboard/") {
                return Response.redirect(new URL("/dashboard", request.url).toString(), 308);
              }

              const toolbarState = getInitialToolbarState(ctx);
              const timezone = await resolveUserTimeZoneForServerRender(
                ctx,
                (request as Request & { cf?: { timezone?: string } }).cf?.timezone,
              );
              const today = getDateStringInTimeZone(new Date(), timezone);
              const todayStart = parseDateParam(today, { timeZone: timezone, boundary: "start" });
              const todayEnd = parseDateParam(today, { timeZone: timezone, boundary: "end" });

              let initialDashboardData: DashboardResponseData | null = null;
              if (toolbarState.initialSiteId && todayStart && todayEnd) {
                try {
                  const dashboardDataResult = await getDashboardDataCore({
                    ctx,
                    requestId: crypto.randomUUID(),
                    siteIdValue: toolbarState.initialSiteId,
                    dateStartValue: todayStart,
                    dateEndValue: todayEnd,
                    rawDateEnd: today,
                    normalizedTimezone: timezone,
                    normalizedDeviceType: null,
                    normalizedCountry: null,
                    normalizedSource: null,
                    normalizedPageUrl: null,
                    normalizedCity: null,
                    normalizedRegion: null,
                    normalizedEventName: null,
                    normalizedEventSummaryLimit: 50,
                    normalizedEventSummaryOffset: 0,
                    normalizedEventSummaryType: "all",
                    normalizedEventSummaryAction: "all",
                    normalizedEventSummarySortBy: "count",
                    normalizedEventSummarySortDirection: "desc",
                    eventSummarySearch: "",
                  });

                  if (dashboardDataResult.ok) {
                    initialDashboardData = dashboardDataResult.data;
                  }
                } catch (error) {
                  if (IS_DEV) {
                    console.log("🔥🔥🔥 failed to prefetch today dashboard", error);
                  }
                }
              }

              return (
                <DashboardPage
                  activeReportBuilderItemId="create-report"
                  reportBuilderEnabled={reportBuilderEnabled}
                  askAiEnabled={askAiEnabled}
                  initialToolbarSites={toolbarState.initialSites}
                  initialToolbarSiteId={toolbarState.initialSiteId}
                  initialDashboardDateRange={{
                    start: today,
                    end: today,
                    preset: "Today",
                  }}
                  initialTimezone={timezone}
                  initialDashboardData={initialDashboardData}
                />
              );
            },
          ]),
          layout<AppRequestInfo>(DashboardWorkspaceLayout, (reportBuilderEnabled
              ? [
                appRoute("/dashboard/reports", [
                  ({ request }) => {
                    return Response.redirect(new URL("/dashboard/reports/create-report", request.url).toString(), 308);
                  },
                ]),
                appRoute("/dashboard/reports/custom/new", [
                  checkIfTeamSetupSites,
                  ({ request }) => {
                    const url = new URL(request.url);
                    const template = url.searchParams.get("template");
                    return <CustomReportBuilderPage initialTemplate={template} />;
                  },
                ]),
                appRoute("/dashboard/reports/custom/*", [
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
                appRoute("/dashboard/reports/create-report", [
                  checkIfTeamSetupSites,
                  (_info) => {
                    return <ReportBuilderWorkspace activeReportBuilderItemId="create-report" />;
                  },
                ]),
                appRoute("/dashboard/reports/create-reference", [
                  checkIfTeamSetupSites,
                  (_info) => {
                    return <ReportBuilderWorkspace activeReportBuilderItemId="create-reference" />;
                  },
                ]),
                appRoute("/dashboard/reports/ask-ai", [
                  checkIfTeamSetupSites,
                  ({ ctx, request }) => {
                    if (!askAiEnabled) {
                      return Response.redirect(new URL("/dashboard/reports/create-report", request.url).toString(), 308);
                    }

                    const aiConfig = getAiConfig(ctx.team.id);
                    const askAiWorkspaceProps = {
                      activeReportBuilderItemId: "ask-ai" as const,
                      initialAiConfigured: Boolean(aiConfig),
                      initialAiModel: aiConfig?.model ?? "",
                    } as const;

                    return <ReportBuilderWorkspace {...askAiWorkspaceProps} />;
                  },
                ]),
                appRoute("/dashboard/reports/create-dashboard", [
                  checkIfTeamSetupSites,
                  (_info) => {
                    return <ReportBuilderWorkspace activeReportBuilderItemId="create-dashboard" />;
                  },
                ]),
                appRoute("/dashboard/reports/create-notification", [
                  checkIfTeamSetupSites,
                  (_info) => {
                    return <ReportBuilderWorkspace activeReportBuilderItemId="create-notification" />;
                  },
                ]),
              ]
              : [
                appRoute("/dashboard/reports", [
                  ({ request }) => {
                    return Response.redirect(new URL("/dashboard", request.url).toString(), 308);
                  },
                ]),
                appRoute("/dashboard/reports/*", [
                  ({ request }) => {
                    return Response.redirect(new URL("/dashboard", request.url).toString(), 308);
                  },
                ]),
              ])),
          ...(eventsEnabled
            ? [
              appRoute("/dashboard/events", [
                checkIfTeamSetupSites,
                async (_info) => {
                  return <EventsPage />;
                },
              ]),
            ]
            : []),
          appRoute("/dashboard/new-site", [
            (_info) => {
              return <NewSiteSetup />;
            },
          ]),
          appRoute("/dashboard/settings", [
            async ({ ctx }) => {
              const toolbarState = getInitialToolbarState(ctx);
              const initialCurrentSite = toolbarState.initialSites.find(
                (site) => site.site_id === toolbarState.initialSiteId,
              ) ?? null;

              const sessionUserSites = Array.isArray(ctx.session.userSites)
                ? ctx.session.userSites
                : [];

              const initialUserSites = sessionUserSites.length > 0
                ? sessionUserSites.map((site) => ({
                  site_id: site.site_id,
                  name: site.name ?? null,
                  domain: site.domain ?? null,
                  tag_id: site.tag_id,
                  createdAt: site.createdAt ?? null,
                }))
                : (ctx.sites ?? []).map((site) => ({
                  site_id: site.site_id,
                  name: site.name ?? null,
                  domain: site.domain ?? null,
                  tag_id: site.tag_id,
                  createdAt: null,
                }));

              const sessionTeam = ctx.session.team;

              let initialTimezone: string | null =
                ctx.session.timezone && typeof ctx.session.timezone === "string"
                  ? ctx.session.timezone
                  : null;

              if (!initialTimezone) {
                try {
                  const dbUser = await d1_client
                    .select({ timezone: user.timezone })
                    .from(user)
                    .where(eq(user.id, ctx.session.user.id))
                    .limit(1);
                  initialTimezone = dbUser[0]?.timezone ?? null;
                } catch (error) {
                  if (IS_DEV) {
                    console.log("🔥🔥🔥 failed to prefetch user timezone", error);
                  }
                }
              }

              const [teamSettingsResult] = await Promise.allSettled([
                getTeamSettings(ctx.team.id),
              ]);

              const initialTeamSettings =
                teamSettingsResult.status === "fulfilled" ? teamSettingsResult.value : null;
              if (teamSettingsResult.status === "rejected" && IS_DEV) {
                console.log("🔥🔥🔥 failed to prefetch team settings", teamSettingsResult.reason);
              }

              return (
                <SettingsPage
                  initialSession={{
                    user: {
                      name: ctx.session.user?.name ?? null,
                      email: ctx.session.user?.email ?? null,
                    },
                    team: {
                      id: sessionTeam?.id ?? ctx.team.id,
                      name: sessionTeam?.name ?? ctx.team.name ?? null,
                      external_id: sessionTeam?.external_id ?? ctx.team.external_id ?? null,
                    },
                    role: ctx.user_role,
                    timezone: initialTimezone,
                    userSites: initialUserSites,
                  }}
                  initialCurrentSite={initialCurrentSite
                    ? {
                      id: initialCurrentSite.site_id,
                      name: initialCurrentSite.name,
                      tag_id: initialCurrentSite.tag_id,
                    }
                    : null}
                  initialSites={toolbarState.initialSites}
                  initialTeamSettings={initialTeamSettings}
                />
              );
            },
          ]),
          appRoute("/dashboard/explore", [
            checkIfTeamSetupSites,
            ({ ctx }) => {
              const toolbarState = getInitialToolbarState(ctx);
              return (
                <ExplorePage
                  initialSites={toolbarState.initialSites}
                  initialSiteId={toolbarState.initialSiteId}
                />
              );
            },
          ]),
          ...(eventsEnabled
            ? [
              appRoute("/admin/events", [
                ({ request }) => {
                  return Response.redirect(new URL("/dashboard/events", request.url).toString(), 308);
                },
              ]),
            ]
            : []),
          appRoute("/new-site", [
            ({ request }) => {
              return Response.redirect(new URL("/dashboard/new-site", request.url).toString(), 308);
            },
          ]),
          appRoute("/settings", [
            ({ request }) => {
              return Response.redirect(new URL("/dashboard/settings", request.url).toString(), 308);
            },
          ]),
          appRoute("/explore", [
            ({ request }) => {
              return Response.redirect(new URL("/dashboard/explore", request.url).toString(), 308);
            },
          ]),
        ])]
        : []),

    ]),
  ]);

  return {
    fetch: app.fetch,
    queue: handleQueueMessage,
  };
}

const defaultApp = createLytxApp();

export default defaultApp;
