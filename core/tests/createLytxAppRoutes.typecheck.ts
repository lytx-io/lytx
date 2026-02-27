import { createLytxApp } from "../index";

type IsAny<T> = 0 extends (1 & T) ? true : false;
type CreateLytxAppConfigInput = Parameters<typeof createLytxApp>[0];
type RoutesInput = NonNullable<CreateLytxAppConfigInput>["routes"];
type RoutesIsAny = IsAny<RoutesInput>;

const routesMustNotBeAny: RoutesIsAny = false;
void routesMustNotBeAny;

createLytxApp({
  routes: {
    ui: {
      dashboard: ({ info, defaultProps, helpers, toolbarState }) => {
        info.ctx.team.id;
        defaultProps.initialDashboardDateRange?.preset;
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
        // @ts-expect-error dashboard preset is only "Today"
        const _: "Yesterday" = defaultProps.initialDashboardDateRange!.preset;
        return new Response("ok");
      },
    },
  },
});

createLytxApp({
  routes: {
    ui: {
      // @ts-expect-error route override must be a function
      events: "not-a-function",
    },
  },
});
