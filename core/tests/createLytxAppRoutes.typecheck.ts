import { createLytxApp } from "../index";
import { route } from "rwsdk/router";

type IsAny<T> = 0 extends (1 & T) ? true : false;
type CreateLytxAppConfigInput = Parameters<typeof createLytxApp>[0];
type RoutesInput = NonNullable<CreateLytxAppConfigInput>["routes"];
type RoutesIsAny = IsAny<RoutesInput>;

type DashboardOverrideArgs = Parameters<
  NonNullable<NonNullable<NonNullable<RoutesInput>["ui"]>["dashboard"]>
>[0];
type TopSourcesDataType = DashboardOverrideArgs["defaultProps"]["reportData"]["TopSourcesData"];
type TopSourcesDataIsAny = IsAny<TopSourcesDataType>;

const routesMustNotBeAny: RoutesIsAny = false;
void routesMustNotBeAny;

const topSourcesDataMustNotBeAny: TopSourcesDataIsAny = false;
void topSourcesDataMustNotBeAny;

createLytxApp({
  cache: {
    persistHistoricalAnalyticsToEventsKv: true,
  },
  routes: {
    document: ({ children, request, path }) => {
      request.url;
      path;
      return children;
    },
    additionalRoutes: [
      route("/dashboard/custom/:slug", ({ params, ctx }) => {
        params.slug;
        ctx.team.id;
        return new Response("ok");
      }),
    ],
    ui: {
      dashboard: ({ info, defaultProps, helpers, toolbarState }) => {
        info.ctx.team.id;
        defaultProps.initialDashboardDateRange?.preset;
        defaultProps.reportData.initialDashboardData;
        // @ts-expect-error moved under reportData
        defaultProps.initialDashboardData;
        toolbarState.initialSiteId;
        helpers.getDashboardDataCore;
        return new Response("ok");
      },
      events: ({ info }) => {
        info.ctx.session.user.id;
        return new Response("ok");
      },
      explore: ({ defaultProps, info }) => {
        defaultProps.initialSiteId;
        info.ctx.session.user.id;
        return new Response("ok");
      },
    },
  },
});

createLytxApp({
  routes: {
    ui: {
      dashboard: ({ defaultProps }) => {
        defaultProps.reportData.initialDashboardData;
        // @ts-expect-error dashboard preset is only "Today"
        const _: "Yesterday" = defaultProps.initialDashboardDateRange!.preset;
        return new Response("ok");
      },
    },
  },
});

createLytxApp({
  cache: {
    // @ts-expect-error cache toggle must be a boolean
    persistHistoricalAnalyticsToEventsKv: "not-a-boolean",
  },
  routes: {
    // @ts-expect-error document override must be a component function
    document: "not-a-component",
    // @ts-expect-error additionalRoutes must be route entries
    additionalRoutes: ["/not-a-route"],
    ui: {
      // @ts-expect-error route override must be a function
      events: "not-a-function",
    },
  },
});
