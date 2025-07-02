import { defineApp, type RequestInfo } from "rwsdk/worker";
import { route, render, prefix, layout } from "rwsdk/router";
import { Document } from "@/app/Document";
import { DashboardPage } from "@/app/Dashboard";
import { EventsPage } from "@/app/Events";
import { Home } from "@/app/pages/Home";
import { AppLayout } from "@/app/Layout";
import { eventsApi, lytxTag, trackWebEvent, newSiteSetup } from "@/api";
import { authMiddleware, sessionMiddleware } from "@/session/auth";
import { Signup } from "@/app/pages/user/Signup";
import { Login } from "@/app/pages/user/Login";
import { NewSiteSetup } from "@/app/components/NewSiteSetup";
import type { DBAdapter } from "@db/d1/schema";
import { getDashboardData } from "@db/d1/sites";
import type { AuthUserSession } from "@lib/auth";
import {
  getDeviceData,
  getDeviceGeoData,
  getEventTypesData,
  getPageViewsData,
  getReferrersData,
  getTopPagesData,
  getTopSourcesData,
  transformToChartData,
} from "@db/tranformReports";

export { SyncDurableObject } from "@/session/durableObject";

export type AppContext = {
  session: AuthUserSession;
  initial_site_setup: boolean;
  sites: Array<any> | null;
  team: number;
  blink_id: string;
  db_adapter: DBAdapter;
};

// Helper function to ensure data is serializable for client components
// function serializeForClient<T>(data: T): T {
//   return JSON.parse(
//     JSON.stringify(data, (_, value) => {
//       // Handle Date objects
//       if (value instanceof Date) {
//         return value.toISOString();
//       }
//       // Handle undefined values
//       if (value === undefined) {
//         return null;
//       }
//       return value;
//     }),
//   );
// }

function checkIfTeamSetupSites({ ctx }: RequestInfo<any, AppContext>) {

  if (!ctx.initial_site_setup) {
    return new Response("User needs to create a site", {
      status: 303,
      headers: { location: "/new-site" },
    });
  }

  if (!ctx.sites) {
    return new Response("User needs to create a site", {
      status: 303,
      headers: { location: "/new-site" },
    });
  }
}

function onlyAllowGetPost({ request }: RequestInfo<any, AppContext>) {
  if (!["GET", "POST"].includes(request.method))
    return new Response("Not Found.", { status: 404 });
}


export default defineApp<RequestInfo<any, AppContext>>([
  ({ request }) => {
    console.log("🔥🔥🔥", request.method, request.url);
  },
  //NOTE: API ROUTES / no component or html rendering
  //TODO: pass db provider as prop from ctx? or initial config
  lytxTag("sqlite"),
  trackWebEvent("sqlite"),
  eventsApi,
  route("/api/auth/*", (r) => authMiddleware(r)),
  render(Document, [
    route("/", [onlyAllowGetPost, async ({ request }) => {
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
      //WARNING: This works with interuptor
      route("/dashboard-works", [checkIfTeamSetupSites, () => {
        return <DashboardPage />;
      }]),
      //FIX: This does not work with ctx in route       
      route("/dashboard-broken", [({ ctx }) => {
        if (!ctx.initial_site_setup) {
          return new Response("User needs to create a site", {
            status: 303,
            headers: { location: "/new-site" },
          });
        }

        if (!ctx.sites) {
          return new Response("User needs to create a site", {
            status: 303,
            headers: { location: "/new-site" },
          });
        }

        return <DashboardPage />;
      }]),
      sessionMiddleware,
      prefix("/api", [
        route("/world_countries", async ({ request }) => {
          if (request.method != "POST")
            return new Response("Not Found.", { status: 404 });
          const include = (await request.json()) as { include: string[] };
          const world_countries = await import(
            "@lib/geojson/world_countries.json"
          );

          if (include.include.length > 0) {
            const filtered = world_countries.features.filter((feature) => {
              return include.include.includes(feature.properties.name);
            });
            return new Response(JSON.stringify(filtered));
          }
          //consider r2 bucket?
          return new Response(JSON.stringify(world_countries));
        }),
        //TODO: re-work this to much data transformation on server do more in db indexed tables
        route("/dashboard/data", async ({ request, ctx, cf }) => {
          if (request.method !== "POST") {
            return new Response("Method not allowed", { status: 405 });
          }

          if (!ctx.session || !ctx.session.user) {
            return new Response(
              JSON.stringify({ error: "Authentication required" }),
              {
                status: 401,
                headers: { "Content-Type": "application/json" },
              },
            );
          }

          if (!ctx.team) {
            return new Response(
              JSON.stringify({ error: "Team access required" }),
              {
                status: 403,
                headers: { "Content-Type": "application/json" },
              },
            );
          }

          try {
            const url = new URL(request.url);
            let params: any = {};

            if (request.method === "POST") {
              try {
                params = await request.json();
              } catch (e) {
                return new Response(
                  JSON.stringify({ error: "Invalid JSON body" }),
                  {
                    status: 400,
                    headers: { "Content-Type": "application/json" },
                  },
                );
              }
            } else {
              params = {
                site_id: url.searchParams.get("site_id"),
                date_start: url.searchParams.get("date_start"),
                date_end: url.searchParams.get("date_end"),
                device_type: url.searchParams.get("device_type"),
                country: url.searchParams.get("country"),
                source: url.searchParams.get("source"),
              };
            }

            const {
              site_id,
              date_start,
              date_end,
              device_type,
              country,
              source,
            } = params;

            if (!site_id) {
              return new Response(
                JSON.stringify({ error: "site_id is required" }),
                {
                  status: 400,
                  headers: { "Content-Type": "application/json" },
                },
              );
            }

            let siteIdValue: number | string;
            if (typeof site_id === "string" && isNaN(parseInt(site_id))) {
              siteIdValue = site_id;
            } else {
              siteIdValue = parseInt(site_id);
              if (isNaN(siteIdValue)) {
                return new Response(
                  JSON.stringify({
                    error: "site_id must be a valid number or string",
                  }),
                  {
                    status: 400,
                    headers: { "Content-Type": "application/json" },
                  },
                );
              }
            }

            const dashboardOptions: any = {
              site_id: siteIdValue,
              // site_id: 82,
              team_id: ctx.team,
            };

            if (date_start || date_end) {
              dashboardOptions.date = {};
              if (date_start) {
                dashboardOptions.date.start = new Date(date_start);
              }
              if (date_end) {
                dashboardOptions.date.end = new Date(date_end);
              }
            }

            const query = getDashboardData(dashboardOptions);
            let dashboardData = await query;

            if (device_type || country || source) {
              dashboardData = dashboardData.filter((item: any) => {
                if (device_type && item.device_type !== device_type)
                  return false;
                if (country && item.country !== country) return false;
                if (source && item.referer !== source) return false;
                return true;
              });
            }

            const {
              pageViews,
              events,
              cities,
              referers,
              devices,
              topPages,
              browsers,
            } = transformToChartData(dashboardData);

            const pageViewsData = getPageViewsData(pageViews);
            const topSourcesData = getTopSourcesData(
              referers
                .slice(0, 10)
                .map((a) => ({ name: a.id, visitors: a.value })),
            );
            const referrersData = getReferrersData(referers.slice(0, 10));
            const eventTypesData = getEventTypesData(events);
            const geoData = cities
              .map(([city, details]) => [details.country, city, details.count])
              .slice(0, 10) as Array<[string, string, number]>;
            const deviceGeoData = getDeviceGeoData({
              geoData,
              deviceData: devices,
            });
            const topPagesData = getTopPagesData(topPages.slice(0, 10));
            const browserData = getDeviceData(
              browsers.map((a) => ({
                name: a.id,
                visitors: a.value,
                percentage: "",
              })),
            );

            const responseData = {
              PageViewsData: pageViewsData,
              EventTypesData: eventTypesData,
              DeviceGeoData: deviceGeoData,
              ReferrersData: referrersData,
              TopPagesData: topPagesData,
              TopSourcesData: topSourcesData,
              BrowserData: browserData.slice(0, 10),
            };

            return new Response(JSON.stringify(responseData), {
              headers: { "Content-Type": "application/json" },
            });
          } catch (error) {
            console.error("Dashboard API error:", error);
            return new Response(
              JSON.stringify({ error: "Internal server error" }),
              {
                status: 500,
                headers: { "Content-Type": "application/json" },
              },
            );
          }
        }),
        ///api/sites
        newSiteSetup,
      ]),
      onlyAllowGetPost,
      route("/admin/events", [checkIfTeamSetupSites, async ({ request }) => {
        // const url = new URL(request.url);
        // const account = url.searchParams.get("account");
        // if (!account) {
        //   return new Response("Account not provided", { status: 400 });
        // }
        return <EventsPage />;
      }]),
      route("/new-site", [() => {
        return <NewSiteSetup />;
      }]),
      route("/dashboard", [({ ctx }) => {
        if (!ctx.initial_site_setup) {
          return new Response("User needs to create a site", {
            status: 303,
            headers: { location: "/new-site" },
          });
        }

        if (!ctx.sites) {
          return new Response("User needs to create a site", {
            status: 303,
            headers: { location: "/new-site" },
          });
        }

        return <DashboardPage />;
      }]),
    ]),
  ]),
]);
