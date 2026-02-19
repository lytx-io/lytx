import { route } from "rwsdk/router";
import type { RequestInfo } from "rwsdk/worker";
import type { AppContext } from "@/types/app-context";
import { checkIfTeamSetupSites } from "@/utilities/route_interuptors";
import { getSiteFromContext } from "@/api/authMiddleware";
import { IS_DEV } from "rwsdk/constants";
// import { auth } from "@lib/auth";
import {
    DashboardResponseData,
    getDeviceData,
    getDeviceGeoData,
    getEventTypesData,
    getPageViewsData,
    getReferrersData,
    getTopPagesData,
    getTopSourcesData,
} from "@db/tranformReports";
import { DashboardOptions } from "@db/types";
import { getDashboardAggregatesFromDurableObject, getDurableDatabaseStub, getEventSummaryFromDurableObject } from "@db/durable/durableObjectClient";
import {
    isDateOnly,
    isValidTimeZone,
    parseDateParam,
    parseSiteIdParam,
} from "@/utilities/dashboardParams";

const DASHBOARD_CACHE_TTL_SECONDS = IS_DEV ? 5 : 30;
const DASHBOARD_CACHE_STALE_SECONDS = 30;

type EventSummaryTypeFilter = "all" | "autocapture" | "event_capture" | "page_view";
type EventSummaryActionFilter = "all" | "click" | "submit" | "change" | "rule";
type EventSummarySortBy = "count" | "first_seen" | "last_seen";
type EventSummarySortDirection = "asc" | "desc";

function formatDuration(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds <= 0) return "0s";
    if (seconds >= 60) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}m ${remainingSeconds}s`;
    }
    return `${Math.floor(seconds)}s`;
}

function cleanRefererValue(referer: string): string {
    if (!referer) return "Direct";
    if (referer === "null") return "Direct";
    return referer.replace(/https?:\/\//, "").replace(/\/.*/, "") || "Direct";
}

function shouldBypassDashboardCache(request: Request): boolean {
    const cacheControl = request.headers.get("Cache-Control")?.toLowerCase() ?? "";
    return (
        cacheControl.includes("no-cache") ||
        cacheControl.includes("no-store") ||
        cacheControl.includes("max-age=0")
    );
}

async function sha256Hex(input: string): Promise<string> {
    const bytes = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

/**
 * GET /api/world_countries
 *
 * This is the world countries API endpoint
 */
export const world_countries = route(
    "/world_countries",
    async ({ request }: RequestInfo<any, AppContext>) => {
        if (request.method != "POST") {
            return new Response("Not Found.", { status: 404 });
        }

        const include = (await request.json()) as { include: string[] };
        const world_countries = await import("@lib/geojson/world_countries.json");

        if (include.include.length > 0) {
            const filtered = world_countries.features.filter((feature) => {
                return include.include.includes(feature.properties.name);
            });
            return new Response(JSON.stringify(filtered));
        }
        //consider r2 bucket?
        return new Response(JSON.stringify(world_countries));
    },
);

export const getCurrentVisitorsRoute = route(
    "/dashboard/current-visitors",
    [
        checkIfTeamSetupSites,
        async ({ request, ctx }: RequestInfo<any, AppContext>) => {
            const requestId = crypto.randomUUID();
            if (request.method !== "GET") {
                return new Response(
                    JSON.stringify({ error: "Method not allowed", requestId }),
                    {
                        status: 405,
                        headers: { "Content-Type": "application/json" },
                    },
                );
            }

            const url = new URL(request.url);
            const site_id = url.searchParams.get("site_id");
            const windowSecondsParam = url.searchParams.get("windowSeconds");

            const windowSeconds = windowSecondsParam
                ? Math.max(1, parseInt(windowSecondsParam, 10))
                : 60 * 5;

            if (!site_id) {
                return new Response(
                    JSON.stringify({ error: "site_id is required", requestId }),
                    {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    },
                );
            }

            const siteIdValue = parseInt(site_id, 10);
            if (Number.isNaN(siteIdValue)) {
                return new Response(
                    JSON.stringify({ error: "site_id must be a valid number", requestId }),
                    {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    },
                );
            }

            const siteDetails = getSiteFromContext(ctx, siteIdValue);
            if (!siteDetails?.uuid) {
                return new Response(
                    JSON.stringify({ error: "Site not found", requestId }),
                    {
                        status: 404,
                        headers: { "Content-Type": "application/json" },
                    },
                );
            }

            try {
                const stub = await getDurableDatabaseStub(siteDetails.uuid, siteIdValue);
                const result = await stub.getCurrentVisitors({ windowSeconds });

                return new Response(JSON.stringify(result), {
                    headers: { "Content-Type": "application/json" },
                });
            } catch (error) {
                console.error("Current visitors API error:", { requestId, error });
                return new Response(
                    JSON.stringify({ error: "Internal server error", requestId }),
                    {
                        status: 500,
                        headers: { "Content-Type": "application/json" },
                    },
                );
            }
        },
    ],
);

type DashboardDataCoreInput = {
    ctx: AppContext;
    requestId: string;
    siteIdValue: number;
    dateStartValue: Date | null;
    dateEndValue: Date | null;
    rawDateEnd: unknown;
    normalizedTimezone: string | null;
    normalizedDeviceType: string | null;
    normalizedCountry: string | null;
    normalizedSource: string | null;
    normalizedPageUrl: string | null;
    normalizedCity: string | null;
    normalizedRegion: string | null;
    normalizedEventName: string | null;
    normalizedEventSummaryLimit: number;
    normalizedEventSummaryOffset: number;
    eventSummarySearch: string;
    normalizedEventSummaryType: EventSummaryTypeFilter;
    normalizedEventSummaryAction: EventSummaryActionFilter;
    normalizedEventSummarySortBy: EventSummarySortBy;
    normalizedEventSummarySortDirection: EventSummarySortDirection;
};

type DashboardDataCoreResult =
    | { ok: true; data: DashboardResponseData }
    | { ok: false; status: number; error: string };

export async function getDashboardDataCore(input: DashboardDataCoreInput): Promise<DashboardDataCoreResult> {
    const {
        ctx,
        siteIdValue,
        dateStartValue,
        dateEndValue,
        rawDateEnd,
        normalizedTimezone,
        normalizedDeviceType,
        normalizedCountry,
        normalizedSource,
        normalizedPageUrl,
        normalizedCity,
        normalizedRegion,
        normalizedEventName,
        normalizedEventSummaryLimit,
        normalizedEventSummaryOffset,
        eventSummarySearch,
        normalizedEventSummaryType,
        normalizedEventSummaryAction,
        normalizedEventSummarySortBy,
        normalizedEventSummarySortDirection,
    } = input;

    if (IS_DEV) console.log("🔥🔥🔥 site_id", siteIdValue);

    const dashboardOptions: DashboardOptions = {
        site_id: siteIdValue,
        site_uuid: "",
        team_id: ctx.team.id,
    };

    const endDateIsDateOnly = isDateOnly(rawDateEnd);
    const endDateIsExact = !endDateIsDateOnly || !!normalizedTimezone;
    if (dateStartValue || dateEndValue) {
        dashboardOptions.date = {
            start: dateStartValue ?? undefined,
            end: dateEndValue ?? undefined,
            endIsExact: endDateIsExact,
        };
    }

    const siteDetails = getSiteFromContext(ctx, siteIdValue);
    if (!siteDetails || !siteDetails.uuid) {
        return { ok: false, status: 404, error: "Site not found" };
    }

    let db_adapter = ctx.db_adapter;
    dashboardOptions.site_uuid = siteDetails.uuid;
    if (siteDetails.site_db_adapter != ctx.db_adapter) {
        db_adapter = siteDetails.site_db_adapter;
    }

    if (db_adapter != "sqlite") {
        if (siteDetails.external_id > 0) {
            dashboardOptions.site_id = siteDetails.external_id;
        }

        const externalTeamId = ctx.team.external_id ?? 0;
        if (externalTeamId > 0) {
            dashboardOptions.team_id = externalTeamId;
        }
    }

    const eventSummary = await getEventSummaryFromDurableObject({
        ...dashboardOptions,
        date: {
            start: dateStartValue ?? undefined,
            end: dateEndValue ?? undefined,
            endIsExact: endDateIsExact,
        },
        limit: normalizedEventSummaryLimit,
        offset: normalizedEventSummaryOffset,
        search: eventSummarySearch,
        type: normalizedEventSummaryType,
        action: normalizedEventSummaryAction,
        sortBy: normalizedEventSummarySortBy,
        sortDirection: normalizedEventSummarySortDirection,
    });

    const dashboardAggregates = await getDashboardAggregatesFromDurableObject({
        ...dashboardOptions,
        date: {
            start: dateStartValue ?? undefined,
            end: dateEndValue ?? undefined,
            endIsExact: endDateIsExact,
        },
        timezone: normalizedTimezone ?? undefined,
        country: normalizedCountry ?? undefined,
        deviceType: normalizedDeviceType ?? undefined,
        source: normalizedSource ?? undefined,
        pageUrl: normalizedPageUrl ?? undefined,
        city: normalizedCity ?? undefined,
        region: normalizedRegion ?? undefined,
        event: normalizedEventName ?? undefined,
    });

    if (!dashboardAggregates) {
        return { ok: false, status: 404, error: "No data found" };
    }

    const pageViewsData = getPageViewsData(dashboardAggregates.pageViews);

    const referers = Array.from(
        dashboardAggregates.referers.reduce((acc, item) => {
            const normalizedReferer = cleanRefererValue(item.id);
            const current = acc.get(normalizedReferer) ?? 0;
            acc.set(normalizedReferer, current + item.value);
            return acc;
        }, new Map<string, number>()),
    )
        .toSorted((a, b) => b[1] - a[1])
        .map(([id, value]) => ({ id, value }));

    const topSourcesData = getTopSourcesData(
        referers
            .slice(0, 10)
            .map((a) => ({ name: a.id, visitors: a.value })),
    );

    const referrersData = getReferrersData(referers.slice(0, 10));

    const eventTypesData = getEventTypesData(dashboardAggregates.events);

    const geoData = dashboardAggregates.cities
        .map(([city, details]) => [details.country, city, details.count]) as Array<[string, string, number]>;

    const deviceGeoData = getDeviceGeoData({
        geoData,
        deviceData: dashboardAggregates.devices,
    });

    const topPagesData = getTopPagesData(dashboardAggregates.topPages.slice(0, 10));

    const browserData = getDeviceData(
        dashboardAggregates.browsers.map((a) => ({
            name: a.id,
            visitors: a.value,
            percentage: "",
        })),
    );

    const osData = getDeviceData(
        dashboardAggregates.operatingSystems.map((a) => ({
            name: a.id,
            visitors: a.value,
            percentage: "",
        })),
    );

    const scoreCards = [
        {
            title: "Uniques",
            value: `${dashboardAggregates.scoreCards.uniqueVisitors.toLocaleString()}`,
            change: "",
            changeType: "neutral",
            changeLabel: "",
        },
        {
            title: "Total Page Views",
            value: `${dashboardAggregates.scoreCards.totalPageViews.toLocaleString()}`,
            change: "",
            changeType: "neutral",
            changeLabel: "",
        },
        {
            title: "Bounce Rate",
            value: `${dashboardAggregates.scoreCards.bounceRatePercent.toFixed(1)}%`,
            change: "",
            changeType: "neutral",
            changeLabel: "",
        },
        {
            title: "Conversion Rate",
            value: `${dashboardAggregates.scoreCards.conversionRatePercent.toFixed(2)}%`,
            change: "",
            changeType: "neutral",
            changeLabel: "",
        },
        {
            title: "Total Events",
            value: `${dashboardAggregates.scoreCards.nonPageViewEvents.toLocaleString()}`,
            change: "",
            changeType: "neutral",
            changeLabel: "",
        },
        {
            title: "Avg Session Duration",
            value: formatDuration(dashboardAggregates.scoreCards.avgSessionDurationSeconds),
            change: "",
            changeType: "neutral",
            changeLabel: "",
        },
    ] as DashboardResponseData["ScoreCards"];

    return {
        ok: true,
        data: {
            noSiteRecordsExist: dashboardAggregates.totalAllTime === 0,
            PageViewsData: pageViewsData,
            EventTypesData: eventTypesData,
            DeviceGeoData: deviceGeoData,
            ReferrersData: referrersData,
            TopPagesData: topPagesData,
            TopSourcesData: topSourcesData,
            ScoreCards: scoreCards,
            BrowserData: browserData.slice(0, 10),
            OSData: osData.slice(0, 10),
            Countries: dashboardAggregates.countries,
            CountryUniques: dashboardAggregates.countryUniques,
            Pagination: dashboardAggregates.pagination,
            Regions: dashboardAggregates.regions,
            EventSummary: eventSummary,
        },
    };
}

export const getDashboardDataRoute = route(
    "/dashboard/data",
    [
        checkIfTeamSetupSites,
        async ({ request, ctx, cf }: RequestInfo<any, AppContext>) => {
            const requestId = crypto.randomUUID();
            if (request.method !== "POST") {
                return new Response(
                    JSON.stringify({ error: "Method not allowed", requestId }),
                    {
                        status: 405,
                        headers: { "Content-Type": "application/json" },
                    },
                );
            }

            const bypassCache = shouldBypassDashboardCache(request);

            try {
                const url = new URL(request.url);

                let params: any = {};
                try {
                    params = await request.json();
                } catch {
                    return new Response(
                        JSON.stringify({ error: "Invalid JSON body", requestId }),
                        {
                            status: 400,
                            headers: { "Content-Type": "application/json" },
                        },
                    );
                }

                const {
                    site_id,
                    date_start,
                    date_end,
                    timezone,
                    device_type,
                    country,
                    source,
                    page_url,
                    city,
                    region,
                    event_name,
                    event_summary_offset,
                    event_summary_limit,
                    event_summary_search,
                    event_summary_type,
                    event_summary_action,
                    event_summary_sort_by,
                    event_summary_sort_direction,
                } = params;

                const requestedTimezone = typeof timezone === "string" ? timezone.trim() : "";
                if (requestedTimezone.length > 0 && !isValidTimeZone(requestedTimezone)) {
                    return new Response(
                        JSON.stringify({ error: "timezone must be a valid IANA timezone", requestId }),
                        {
                            status: 400,
                            headers: { "Content-Type": "application/json" },
                        },
                    );
                }

                const sessionTimezone = (ctx.session as { timezone?: unknown } | undefined)?.timezone;
                const normalizedTimezone = requestedTimezone.length > 0
                    ? requestedTimezone
                    : isValidTimeZone(sessionTimezone)
                        ? sessionTimezone
                        : null;

                if (site_id === undefined || site_id === null || site_id === "") {
                    return new Response(
                        JSON.stringify({ error: "site_id is required", requestId }),
                        {
                            status: 400,
                            headers: { "Content-Type": "application/json" },
                        },
                    );
                }

                const siteIdValue = parseSiteIdParam(site_id);
                if (siteIdValue === null) {
                    return new Response(
                        JSON.stringify({ error: "site_id must be a valid number", requestId }),
                        {
                            status: 400,
                            headers: { "Content-Type": "application/json" },
                        },
                    );
                }

                const dateStartValue = parseDateParam(date_start, {
                    timeZone: normalizedTimezone,
                    boundary: "start",
                });
                if (date_start && !dateStartValue) {
                    return new Response(
                        JSON.stringify({ error: "date_start must be a valid date", requestId }),
                        {
                            status: 400,
                            headers: { "Content-Type": "application/json" },
                        },
                    );
                }

                const dateEndValue = parseDateParam(date_end, {
                    timeZone: normalizedTimezone,
                    boundary: "end",
                });
                if (date_end && !dateEndValue) {
                    return new Response(
                        JSON.stringify({ error: "date_end must be a valid date", requestId }),
                        {
                            status: 400,
                            headers: { "Content-Type": "application/json" },
                        },
                    );
                }

                const normalizedDeviceType =
                    typeof device_type === "string" ? device_type.toLowerCase() : null;
                const normalizedCountry =
                    typeof country === "string" ? country.toUpperCase() : null;
                const normalizedSource = typeof source === "string" ? source.toLowerCase() : null;
                const normalizedPageUrl = typeof page_url === "string" && page_url.length > 0 ? page_url : null;
                const normalizedCity = typeof city === "string" && city.length > 0 ? city : null;
                const normalizedRegion = typeof region === "string" && region.length > 0 ? region : null;
                const normalizedEventName = typeof event_name === "string" && event_name.length > 0 ? event_name : null;
                const eventSummaryOffset =
                    typeof event_summary_offset === "number"
                        ? event_summary_offset
                        : Number(event_summary_offset ?? 0);
                const eventSummaryLimit =
                    typeof event_summary_limit === "number"
                        ? event_summary_limit
                        : Number(event_summary_limit ?? 50);
                const eventSummarySearch =
                    typeof event_summary_search === "string"
                        ? event_summary_search.trim()
                        : "";
                const normalizedEventSummaryType: EventSummaryTypeFilter =
                    event_summary_type === "autocapture"
                        || event_summary_type === "event_capture"
                        || event_summary_type === "page_view"
                        ? event_summary_type
                        : "all";
                const normalizedEventSummaryAction: EventSummaryActionFilter =
                    event_summary_action === "click"
                        || event_summary_action === "submit"
                        || event_summary_action === "change"
                        || event_summary_action === "rule"
                        ? event_summary_action
                        : "all";
                const normalizedEventSummarySortBy: EventSummarySortBy =
                    event_summary_sort_by === "first_seen"
                        || event_summary_sort_by === "last_seen"
                        ? event_summary_sort_by
                        : "count";
                const normalizedEventSummarySortDirection: EventSummarySortDirection =
                    event_summary_sort_direction === "asc"
                        ? "asc"
                        : "desc";
                const normalizedEventSummaryOffset = Number.isFinite(eventSummaryOffset)
                    ? Math.max(0, eventSummaryOffset)
                    : 0;
                const normalizedEventSummaryLimit = Number.isFinite(eventSummaryLimit)
                    ? Math.min(Math.max(1, eventSummaryLimit), 100)
                    : 50;

                const cache = (caches as CacheStorage & { default: Cache }).default;

                const cacheKeyPayload = {
                    teamId: ctx.team.id,
                    teamExternalId: ctx.team.external_id ?? null,
                    siteId: siteIdValue,
                    dateStart: dateStartValue ? dateStartValue.toISOString() : null,
                    dateEnd: dateEndValue ? dateEndValue.toISOString() : null,
                    deviceType: normalizedDeviceType,
                    country: normalizedCountry,
                    source: normalizedSource,
                    pageUrl: normalizedPageUrl,
                    city: normalizedCity,
                    region: normalizedRegion,
                    eventName: normalizedEventName,
                    eventSummaryOffset: normalizedEventSummaryOffset,
                    eventSummaryLimit: normalizedEventSummaryLimit,
                    eventSummarySearch,
                    eventSummaryType: normalizedEventSummaryType,
                    eventSummaryAction: normalizedEventSummaryAction,
                    eventSummarySortBy: normalizedEventSummarySortBy,
                    eventSummarySortDirection: normalizedEventSummarySortDirection,
                    timezone: normalizedTimezone,
                    dbAdapter: ctx.db_adapter,
                };

                const cacheKeyHash = await sha256Hex(JSON.stringify(cacheKeyPayload));
                const cacheKeyUrl = new URL(url.toString());
                cacheKeyUrl.searchParams.set("cache", cacheKeyHash);

                // Cache API does not support POST keys directly.
                const cacheKey = new Request(cacheKeyUrl.toString(), { method: "GET" });

                if (!bypassCache) {
                    const cached = await cache.match(cacheKey);
                    if (cached) {
                        const cachedResponse = new Response(cached.body, cached);
                        cachedResponse.headers.set("X-Cache", "HIT");
                        return cachedResponse;
                    }
                }

                const dashboardDataResult = await getDashboardDataCore({
                    ctx,
                    requestId,
                    siteIdValue,
                    dateStartValue,
                    dateEndValue,
                    rawDateEnd: date_end,
                    normalizedTimezone,
                    normalizedDeviceType,
                    normalizedCountry,
                    normalizedSource,
                    normalizedPageUrl,
                    normalizedCity,
                    normalizedRegion,
                    normalizedEventName,
                    normalizedEventSummaryLimit,
                    normalizedEventSummaryOffset,
                    eventSummarySearch,
                    normalizedEventSummaryType,
                    normalizedEventSummaryAction,
                    normalizedEventSummarySortBy,
                    normalizedEventSummarySortDirection,
                });

                if (!dashboardDataResult.ok) {
                    return new Response(
                        JSON.stringify({ error: dashboardDataResult.error, requestId }),
                        {
                            status: dashboardDataResult.status,
                            headers: { "Content-Type": "application/json" },
                        },
                    );
                }

                const responseData = dashboardDataResult.data;

                const headers = new Headers({ "Content-Type": "application/json" });
                headers.set(
                    "Cache-Control",
                    `max-age=0, s-maxage=${DASHBOARD_CACHE_TTL_SECONDS}, stale-while-revalidate=${DASHBOARD_CACHE_STALE_SECONDS}`,
                );
                headers.set("X-Cache", bypassCache ? "BYPASS" : "MISS");

                const response = new Response(JSON.stringify(responseData), { headers });

                if (!bypassCache) {
                    cf.waitUntil(cache.put(cacheKey, response.clone()));
                }

                return response;
            } catch (error) {
                console.error("Dashboard request error:", { requestId, error });
                return new Response(
                    JSON.stringify({ error: "Internal server error", requestId }),
                    {
                        status: 500,
                        headers: { "Content-Type": "application/json" },
                    },
                );
            }
        },
    ],
);

export const siteEventsSqlRoute = route(
    "/site-events/query",
    [
        checkIfTeamSetupSites,
        async ({ request, ctx }: RequestInfo<any, AppContext>) => {
            const requestId = crypto.randomUUID();
            if (request.method !== "POST") {
                return new Response(
                    JSON.stringify({ error: "Method not allowed", requestId }),
                    {
                        status: 405,
                        headers: { "Content-Type": "application/json" },
                    },
                );
            }

            let body: { site_id?: unknown; query?: unknown; limit?: unknown } = {};
            try {
                body = await request.json();
            } catch {
                return new Response(
                    JSON.stringify({ error: "Invalid JSON body", requestId }),
                    {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    },
                );
            }

            if (body.site_id === undefined || body.site_id === null || body.site_id === "") {
                return new Response(
                    JSON.stringify({ error: "site_id is required", requestId }),
                    {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    },
                );
            }

            const siteIdValue = parseSiteIdParam(body.site_id);
            if (siteIdValue === null) {
                return new Response(
                    JSON.stringify({ error: "site_id must be a valid number", requestId }),
                    {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    },
                );
            }

            const query = typeof body.query === "string" ? body.query.trim() : "";
            if (!query) {
                return new Response(
                    JSON.stringify({ error: "query is required", requestId }),
                    {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    },
                );
            }

            const siteDetails = getSiteFromContext(ctx, siteIdValue);
            if (!siteDetails?.uuid) {
                return new Response(
                    JSON.stringify({ error: "Site not found", requestId }),
                    {
                        status: 404,
                        headers: { "Content-Type": "application/json" },
                    },
                );
            }

            const limit = typeof body.limit === "number" && Number.isFinite(body.limit)
                ? Math.max(1, Math.floor(body.limit))
                : undefined;

            try {
                const stub = await getDurableDatabaseStub(siteDetails.uuid, siteIdValue);
                const result = await stub.runSqlQuery(query, limit ? { limit } : undefined);

                if (!result?.success) {
                    return new Response(
                        JSON.stringify({ error: result?.error || "Query failed", requestId }),
                        {
                            status: 400,
                            headers: { "Content-Type": "application/json" },
                        },
                    );
                }

                return new Response(
                    JSON.stringify({
                        rows: result.rows || [],
                        rowCount: result.rowCount ?? 0,
                        limit: result.limit,
                    }),
                    {
                        status: 200,
                        headers: { "Content-Type": "application/json" },
                    },
                );
            } catch (error) {
                console.error("SQL query error:", { requestId, error });
                return new Response(
                    JSON.stringify({ error: "Internal server error", requestId }),
                    {
                        status: 500,
                        headers: { "Content-Type": "application/json" },
                    },
                );
            }
        },
    ],
);

export const siteEventsSchemaRoute = route(
    "/site-events/schema",
    [
        checkIfTeamSetupSites,
        async ({ request, ctx }: RequestInfo<any, AppContext>) => {
            const requestId = crypto.randomUUID();
            if (request.method !== "GET" && request.method !== "POST") {
                return new Response(
                    JSON.stringify({ error: "Method not allowed", requestId }),
                    {
                        status: 405,
                        headers: { "Content-Type": "application/json" },
                    },
                );
            }

            // Get site_id from query params (GET) or body (POST)
            let siteIdValue: number | null = null;
            
            if (request.method === "GET") {
                const url = new URL(request.url);
                const siteIdParam = url.searchParams.get("site_id");
                siteIdValue = parseSiteIdParam(siteIdParam);
            } else {
                try {
                    const body = await request.json() as { site_id?: unknown };
                    siteIdValue = parseSiteIdParam(body.site_id);
                } catch {
                    return new Response(
                        JSON.stringify({ error: "Invalid JSON body", requestId }),
                        {
                            status: 400,
                            headers: { "Content-Type": "application/json" },
                        },
                    );
                }
            }

            if (siteIdValue === null) {
                return new Response(
                    JSON.stringify({ error: "site_id is required and must be a valid number", requestId }),
                    {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    },
                );
            }

            const siteDetails = getSiteFromContext(ctx, siteIdValue);
            if (!siteDetails?.uuid) {
                return new Response(
                    JSON.stringify({ error: "Site not found", requestId }),
                    {
                        status: 404,
                        headers: { "Content-Type": "application/json" },
                    },
                );
            }

            try {
                const stub = await getDurableDatabaseStub(siteDetails.uuid, siteIdValue);
                const result = await stub.getSchema();

                if (!result?.success) {
                    return new Response(
                        JSON.stringify({ error: result?.error || "Failed to get schema", requestId }),
                        {
                            status: 500,
                            headers: { "Content-Type": "application/json" },
                        },
                    );
                }

                return new Response(
                    JSON.stringify({
                        tables: result.tables,
                        siteId: result.siteId,
                    }),
                    {
                        status: 200,
                        headers: { "Content-Type": "application/json" },
                    },
                );
            } catch (error) {
                console.error("Schema fetch error:", { requestId, error });
                return new Response(
                    JSON.stringify({ error: "Internal server error", requestId }),
                    {
                        status: 500,
                        headers: { "Content-Type": "application/json" },
                    },
                );
            }
        },
    ],
);
