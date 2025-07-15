import { route } from "rwsdk/router";
import type { RequestInfo } from "rwsdk/worker";
import type { AppContext } from "@/worker";
import { getDashboardData } from "@db/adapter";
import { checkIfTeamSetupSites } from "@/utilities/route_interuptors";
import {
    DashboardResponseData,
    getDeviceData,
    getDeviceGeoData,
    getEventTypesData,
    getPageViewsData,
    getReferrersData,
    getTopPagesData,
    getTopSourcesData,
    transformToChartData,
} from "@db/tranformReports";
import { DashboardOptions } from "@db/types";

/**
 * GET /api/world_countries
 *
 * This is the world countries API endpoint
 */
export const world_countries = route<RequestInfo<any, AppContext>>("/world_countries", async ({ request }) => {
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
})


export const getDashboardDataRoute = route("/dashboard/data", [checkIfTeamSetupSites, async ({ request, ctx, cf }) => {
    if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
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


        const { site_id, date_start, date_end, device_type, country, source } = params;

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
        console.log("🔥🔥🔥 site_id", siteIdValue);
        const dashboardOptions: DashboardOptions = {
            site_id: siteIdValue,
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

        const { client, query, noSiteRecordsExist } = await getDashboardData(ctx.db_adapter, dashboardOptions);

        let dashboardData = await query;
        const recordsExist = await noSiteRecordsExist;
        if (!dashboardData) { return new Response("No data found", { status: 404 }) }
        console.log("🔥🔥🔥 dashboardData", dashboardData[0]);

        if (device_type || country || source) {
            dashboardData = dashboardData.filter((item) => {
                if (device_type && item.device_type !== device_type)
                    return false;
                if (country && item.country !== country) return false;
                if (source && item.referer !== source) return false;
                return true;
            });
        }

        const { pageViews, events, cities, referers, devices, topPages, browsers } = transformToChartData(dashboardData);

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

        const deviceGeoData = getDeviceGeoData({ geoData, deviceData: devices, });

        const topPagesData = getTopPagesData(topPages.slice(0, 10));

        const browserData = getDeviceData(
            browsers.map((a) => ({
                name: a.id,
                visitors: a.value,
                percentage: "",
            })),
        );

        if (client) {
            cf.waitUntil(client.$client.end());
        }

        const responseData: DashboardResponseData = {
            noSiteRecordsExist: recordsExist,
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
}])
