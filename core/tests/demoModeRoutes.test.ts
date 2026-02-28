import { afterEach, describe, expect, mock, test } from "bun:test";

type RouteEntry = {
  path: string;
  handlers: Array<(args: any) => unknown>;
};

type LayoutEntry = {
  component: unknown;
  handlers: Array<(args: any) => unknown>;
};

let routeEntries: RouteEntry[] = [];
let layoutEntries: LayoutEntry[] = [];

const sessionMiddlewareMock = mock(() => undefined);
const demoSessionMiddlewareMock = mock(() => undefined);
const onlyAllowGetPostMock = mock(() => undefined);
const AppLayoutComponent = function AppLayoutComponent() {
  return null;
};

function setupWorkerRouteTestMocks() {
  routeEntries = [];
  layoutEntries = [];

  mock.module("rwsdk/worker", () => ({
    defineApp: (entries: unknown[]) => ({ entries }),
  }));

  mock.module("rwsdk/router", () => ({
    route: (path: string, handlers: unknown) => {
      const normalizedHandlers = (Array.isArray(handlers) ? handlers : [handlers]) as Array<(args: any) => unknown>;
      const entry: RouteEntry = { path, handlers: normalizedHandlers };
      routeEntries.push(entry);
      return entry;
    },
    render: (_document: unknown, entries: unknown[]) => ({ type: "render", entries }),
    prefix: (path: string, entries: unknown[]) => ({ type: "prefix", path, entries }),
    layout: (component: unknown, handlers: unknown) => {
      const normalizedHandlers = (Array.isArray(handlers) ? handlers : [handlers]) as Array<(args: any) => unknown>;
      const entry: LayoutEntry = { component, handlers: normalizedHandlers };
      layoutEntries.push(entry);
      return { type: "layout", component, handlers: normalizedHandlers };
    },
  }));

  mock.module("@/Document", () => ({ Document: () => null }));
  mock.module("@/app/Dashboard", () => ({ DashboardPage: () => null }));
  mock.module("@/app/Events", () => ({ EventsPage: () => null }));
  mock.module("@/app/Explore", () => ({ ExplorePage: () => null }));
  mock.module("@/app/Layout", () => ({ AppLayout: AppLayoutComponent }));
  mock.module("@/app/Settings", () => ({ SettingsPage: () => null }));
  mock.module("@/app/components/NewSiteSetup", () => ({ NewSiteSetup: () => null }));
  mock.module("@/app/components/reports/DashboardWorkspaceLayout", () => ({ DashboardWorkspaceLayout: () => null }));
  mock.module("@/app/components/reports/ReportBuilderWorkspace", () => ({ ReportBuilderWorkspace: () => null }));
  mock.module("@/app/components/reports/custom/CustomReportBuilderPage", () => ({ CustomReportBuilderPage: () => null }));
  mock.module("@/pages/Signup", () => ({ Signup: () => null }));
  mock.module("@/pages/Login", () => ({ Login: () => null }));
  mock.module("@/pages/VerifyEmail", () => ({ VerifyEmail: () => null }));

  mock.module("@api/events_api", () => ({ eventsApi: { type: "eventsApi" } }));
  mock.module("@api/seed_api", () => ({ seedApi: { type: "seedApi" } }));
  mock.module("@api/team_api", () => ({ team_dashboard_endpoints: { type: "teamDashboardEndpoints" } }));
  mock.module("@api/sites_api", () => ({
    world_countries: { type: "worldCountries" },
    getCurrentVisitorsRoute: { type: "getCurrentVisitorsRoute" },
    getDashboardDataCore: mock(async () => ({ data: [] })),
    getDashboardDataRoute: { type: "getDashboardDataRoute" },
    siteEventsSqlRoute: { type: "siteEventsSqlRoute" },
    siteEventsSchemaRoute: { type: "siteEventsSchemaRoute" },
  }));
  mock.module("@api/ai_api", () => ({
    aiChatRoute: { type: "aiChatRoute" },
    aiConfigRoute: { type: "aiConfigRoute" },
    aiTagSuggestRoute: { type: "aiTagSuggestRoute" },
    getAiConfig: () => null,
    setAiRuntimeOverrides: () => undefined,
  }));
  mock.module("@api/auth_api", () => ({
    resendVerificationEmailRoute: { type: "resendVerificationEmailRoute" },
    userApiRoutes: { type: "userApiRoutes" },
  }));
  mock.module("@api/event_labels_api", () => ({ eventLabelsApi: { type: "eventLabelsApi" } }));
  mock.module("@api/reports_api", () => ({ reportsApi: { type: "reportsApi" } }));
  mock.module("@api/tag_api_v2", () => ({
    lytxTag: () => ({ type: "lytxTag" }),
    newSiteSetup: () => ({ type: "newSiteSetup" }),
    trackWebEvent: () => ({ type: "trackWebEvent" }),
  }));

  mock.module("@api/authMiddleware", () => ({
    authMiddleware: mock(async () => new Response("ok")),
    sessionMiddleware: sessionMiddlewareMock,
  }));
  mock.module("@api/demo_middleware", () => ({
    demoSessionMiddleware: demoSessionMiddlewareMock,
  }));

  mock.module("@lib/auth", () => ({
    canRegisterEmail: async () => true,
    getSignupAccessState: async () => ({
      mode: "bootstrap_then_invite",
      hasUsers: false,
      bootstrapSignupOpen: true,
      publicSignupOpen: true,
    }),
    getAuth: () => ({ api: { verifyEmail: async () => undefined } }),
    getAuthProviderAvailability: () => ({ google: false, github: false }),
    setAuthRuntimeConfig: () => undefined,
  }));

  mock.module("@utilities/route_interuptors", () => ({
    checkIfTeamSetupSites: () => undefined,
    onlyAllowGetPost: onlyAllowGetPostMock,
  }));

  mock.module("rwsdk/constants", () => ({ IS_DEV: false }));
  mock.module("@/api/queueWorker", () => ({ handleQueueMessage: async () => new Response("ok") }));

  mock.module("@/lib/featureFlags", () => ({
    isAiFeatureEnabled: () => false,
    isAskAiEnabled: () => false,
    isAuthEnabled: () => true,
    isDashboardEnabled: () => true,
    isEventsEnabled: () => false,
    isReportBuilderEnabled: () => false,
    isTagScriptEnabled: () => false,
  }));

  mock.module("@lib/sendMail", () => ({ setEmailFromAddress: () => undefined }));
  mock.module("@/utilities/dashboardParams", () => ({ parseDateParam: () => null }));
  mock.module("@db/d1/teams", () => ({
    getTeamSettings: async () => ({ members: [], keys: [], sites: [], pendingInvites: [] }),
  }));
  mock.module("@db/d1/client", () => ({
    d1_client: {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [],
          }),
        }),
      }),
    },
  }));
  mock.module("@db/d1/schema", () => ({
    user: {
      timezone: "timezone",
      id: "id",
    },
    team: {
      id: "team.id",
      name: "team.name",
      external_id: "team.external_id",
      db_adapter: "team.db_adapter",
    },
    sites: {
      team_id: "sites.team_id",
    },
  }));
  mock.module("drizzle-orm", () => ({
    eq: () => ({}),
    and: () => ({}),
    asc: () => ({}),
  }));

  mock.module("@/session/durableObject", () => ({ SyncDurableObject: class SyncDurableObject {} }));
  mock.module("@db/durable/siteDurableObject", () => ({ SiteDurableObject: class SiteDurableObject {} }));
}

afterEach(() => {
  mock.restore();
});

describe("createLytxApp demo mode route behavior", () => {
  test("redirects / to /dashboard and uses demo middleware in demo mode", async () => {
    setupWorkerRouteTestMocks();

    const { createLytxApp } = await import("../src/worker");
    routeEntries = [];
    layoutEntries = [];
    createLytxApp({
      auth: { signupMode: "demo" },
      features: {
        auth: true,
        dashboard: true,
        events: false,
        ai: false,
        tagScript: false,
        reportBuilderEnabled: false,
        askAiEnabled: false,
      },
    });

    const rootRoute = routeEntries.find((entry) => entry.path === "/");
    expect(rootRoute).toBeDefined();

    const rootResponse = rootRoute?.handlers[1]({
      request: new Request("https://example.com/", { method: "GET" }),
    }) as Response;

    expect(rootResponse.status).toBe(308);
    expect(rootResponse.headers.get("location")).toBe("https://example.com/dashboard");

    const appLayoutEntry = layoutEntries.find((entry) => entry.component === AppLayoutComponent);
    expect(appLayoutEntry?.handlers[0]).toBe(demoSessionMiddlewareMock);

    const dashboardSettingsRoute = routeEntries.find((entry) => entry.path === "/dashboard/settings");
    expect(dashboardSettingsRoute).toBeDefined();
    const dashboardSettingsResponse = await dashboardSettingsRoute?.handlers[0]({
      request: new Request("https://example.com/dashboard/settings", { method: "GET" }),
      ctx: {
        session: {
          user: { id: "demo-user" },
          userSites: [],
          team: null,
          timezone: null,
        },
      },
    }) as Response;
    expect(dashboardSettingsResponse.status).toBe(308);
    expect(dashboardSettingsResponse.headers.get("location")).toBe("https://example.com/dashboard");

    const settingsAliasRoute = routeEntries.find((entry) => entry.path === "/settings");
    expect(settingsAliasRoute).toBeDefined();
    const settingsAliasResponse = settingsAliasRoute?.handlers[0]({
      request: new Request("https://example.com/settings", { method: "GET" }),
    }) as Response;
    expect(settingsAliasResponse.status).toBe(308);
    expect(settingsAliasResponse.headers.get("location")).toBe("https://example.com/dashboard");
  });

  test("keeps default / -> /login redirect and session middleware", async () => {
    setupWorkerRouteTestMocks();

    const { createLytxApp } = await import("../src/worker");
    routeEntries = [];
    layoutEntries = [];
    createLytxApp({
      features: {
        auth: true,
        dashboard: true,
        events: false,
        ai: false,
        tagScript: false,
        reportBuilderEnabled: false,
        askAiEnabled: false,
      },
    });

    const rootRoute = routeEntries.find((entry) => entry.path === "/");
    expect(rootRoute).toBeDefined();

    const rootResponse = rootRoute?.handlers[1]({
      request: new Request("https://example.com/", { method: "GET" }),
    }) as Response;

    expect(rootResponse.status).toBe(308);
    expect(rootResponse.headers.get("location")).toBe("https://example.com/login");

    const appLayoutEntry = layoutEntries.find((entry) => entry.component === AppLayoutComponent);
    expect(appLayoutEntry?.handlers[0]).toBe(sessionMiddlewareMock);

    const settingsAliasRoute = routeEntries.find((entry) => entry.path === "/settings");
    expect(settingsAliasRoute).toBeDefined();
    const settingsAliasResponse = settingsAliasRoute?.handlers[0]({
      request: new Request("https://example.com/settings", { method: "GET" }),
    }) as Response;
    expect(settingsAliasResponse.status).toBe(308);
    expect(settingsAliasResponse.headers.get("location")).toBe("https://example.com/dashboard/settings");
  });

  test("applies typed route UI overrides for dashboard, events, and explore", async () => {
    setupWorkerRouteTestMocks();

    const dashboardOverride = mock(() => new Response("dashboard override"));
    const eventsOverride = mock(() => new Response("events override"));
    const exploreOverride = mock(() => new Response("explore override"));

    const { createLytxApp } = await import("../src/worker");
    routeEntries = [];
    layoutEntries = [];

    createLytxApp({
      features: {
        auth: true,
        dashboard: true,
        events: true,
        ai: false,
        tagScript: false,
        reportBuilderEnabled: false,
        askAiEnabled: false,
      },
      routes: {
        ui: {
          dashboard: dashboardOverride,
          events: eventsOverride,
          explore: exploreOverride,
        },
      },
    });

    const baseCtx = {
      sites: [{ site_id: 7, name: "Main", tag_id: "tag-7" }],
      session: {
        user: { id: "user-1" },
        last_site_id: 7,
        timezone: "UTC",
      },
      team: { id: "team-1" },
    };

    const dashboardRoute = routeEntries.find((entry) => entry.path === "/dashboard");
    const dashboardResponse = await dashboardRoute?.handlers[1]({
      request: new Request("https://example.com/dashboard", { method: "GET" }),
      ctx: baseCtx,
    }) as Response;
    expect(dashboardResponse.status).toBe(200);
    expect(await dashboardResponse.text()).toBe("dashboard override");
    expect(dashboardOverride).toHaveBeenCalledTimes(1);

    const eventsRoute = routeEntries.find((entry) => entry.path === "/dashboard/events");
    const eventsResponse = await eventsRoute?.handlers[1]({
      request: new Request("https://example.com/dashboard/events", { method: "GET" }),
      ctx: baseCtx,
    }) as Response;
    expect(eventsResponse.status).toBe(200);
    expect(await eventsResponse.text()).toBe("events override");
    expect(eventsOverride).toHaveBeenCalledTimes(1);

    const exploreRoute = routeEntries.find((entry) => entry.path === "/dashboard/explore");
    const exploreResponse = await exploreRoute?.handlers[1]({
      request: new Request("https://example.com/dashboard/explore", { method: "GET" }),
      ctx: baseCtx,
    }) as Response;
    expect(exploreResponse.status).toBe(200);
    expect(await exploreResponse.text()).toBe("explore override");
    expect(exploreOverride).toHaveBeenCalledTimes(1);
  });

  test("appends routes.additionalRoutes into the core route tree", async () => {
    setupWorkerRouteTestMocks();

    const customRoute = {
      path: "/dashboard/custom",
      handler: () => new Response("custom route"),
    };

    const { createLytxApp } = await import("../src/worker");
    createLytxApp({
      routes: {
        additionalRoutes: [customRoute],
      },
    });

    const appLayoutEntry = layoutEntries.find((entry) => entry.component === AppLayoutComponent);
    expect(appLayoutEntry?.handlers.includes(customRoute as never)).toBe(true);
  });
});
