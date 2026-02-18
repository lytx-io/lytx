import { route } from "rwsdk/router";
import type { RequestInfo } from "rwsdk/worker";
import { env } from "cloudflare:workers";
import { IS_DEV } from "rwsdk/constants";
import { parseBrowser, parseOs, parseDeviceType, parseUserAgent } from "@/utilities/detector";
import type { AppContext } from "@/types/app-context";
import { type PageEvent, } from "@/templates/lytxpixel";


import { script_tag_manager, script_core } from "virtual:lytx-pixel-raw";

import { getSiteForTag, insertSiteEvent } from "@db/postgres/sites";
import {
    blockedQueryParams,
    WebEvent,
} from "@/templates/trackWebEvents";


// import DeviceDetector from "device-detector-js";
import Mustache from "mustache";
import { hashIpAddress } from "@/utilities";
import { createSite } from "@db/d1/sites";
import type { DBAdapter } from "@db/types";

// import { getClient } from "@db/client";

export const dataVariableName = "lytxDataLayer" as const;


//WARNING: This only needs to be used on tag routes for third party sites
export function corsMiddleware({ request, response }: RequestInfo) {
    const headers = response.headers;
    // Allow all origins for embedding on third-party sites
    headers.set("Access-Control-Allow-Origin", "*");

    // Match your previous methods
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS, GET");

    // Include all headers from your previous setup
    headers.set("Access-Control-Allow-Headers", "X-Custom-Header, Upgrade-Insecure-Requests, Content-Type");

    // Match your previous exposed headers
    headers.set("Access-Control-Expose-Headers", "Content-Length, X-Kuma-Revision");

    // Match your previous max age
    headers.set("Access-Control-Max-Age", "600");

    // Match your previous credentials setting (false)
    headers.set("Access-Control-Allow-Credentials", "false");

}

//TODO: Add CORS Middleware
// origin: "*",
//     allowHeaders: ["X-Custom-Header", "Upgrade-Insecure-Requests"],
//     allowMethods: ["POST", "OPTIONS", "GET"],
//     exposeHeaders: ["Content-Length", "X-Kuma-Revision"],
//     maxAge: 600,
//     credentials: false,

/**
 * @deprecated
 * GET /container.js
 * 
 * This is the legacy container.js endpoint
 */
export const legacyContainerRoute = route("/container.js", async ({ request }) => {
    if (request.method != "GET") return new Response("Not Found.", { status: 404 });
    return new Response(`console.log('This Script has been deprecated please migrate to lytx.js')`, {
        headers: {
            "Content-Type": "text/javascript",
        },
    });
});


/**
 *
 * GET /lytx.js
 *
 * This is the lytx.js endpoint main tag
 */

export const lytxTag = (adapter: DBAdapter) => route("/lytx.js", [corsMiddleware, async ({ request }) => {
    if (request.method != "GET") return new Response("Not Found.", { status: 404 });
    const url = new URL(request.url);

    //TODO: wire this up with adapter functions
    // const client = getClient(adapter);

    const account = url.searchParams.get("account");
    const platform = url.searchParams.get("platform") ?? "web";

    const queryParams = url.searchParams;
    //do this part from the parser
    const queryParamsObj = Object.entries(queryParams).filter(
        ([key]) => key !== "account" && key !== "platform"
    );
    //do this part from the parser
    const queryParamsStr = queryParamsObj
        .map(([key, value]) => {
            return `&${key}=${value.join("&")}`;
        })
        .join("");

    let events: null | PageEvent[] = null;
    const config = {
        site: "",
        tag: "",
        track_web_events: false,
        tag_manager: false,
        gdpr: false,
        autocapture: false,
        event_load_strategy: "sdk" as "sdk" | "kv",
    };
    if (account) {
        //TODO: Make function that reads from adapter
        const checkAccouuntByTagId = await getSiteForTag(account);

        let accountKey = null;
        if (checkAccouuntByTagId) {
            //console.log(checkAccouuntByTagId);
            if (checkAccouuntByTagId.tag_id_override) {
                //use override
                accountKey = checkAccouuntByTagId.tag_id_override;
            } else {
                //use tag id
                accountKey = checkAccouuntByTagId.tag_id;
            }
            config.site = checkAccouuntByTagId.domain ?? "";
            config.tag = checkAccouuntByTagId.tag_id ?? "";
            config.track_web_events = checkAccouuntByTagId.track_web_events;
            // tag_manager may not exist in postgres schema (legacy), default to false
            config.tag_manager = (checkAccouuntByTagId as any).tag_manager ?? false;
            config.gdpr = checkAccouuntByTagId.gdpr ?? false;
            // autocapture may not exist in postgres schema yet, default to false
            config.autocapture = (checkAccouuntByTagId as any).autocapture ?? false;
            config.event_load_strategy = (checkAccouuntByTagId.event_load_strategy ?? "sdk") as "sdk" | "kv";
        } else {
            //throw an error
            if (IS_DEV) console.log('🔥🔥🔥 No account found for ', account);
        }
        if (accountKey && config.event_load_strategy !== "sdk") {
            const checkKey = (await env.LYTX_EVENTS.get(accountKey, {
                type: "json",
            })) as unknown as PageEvent[];
            //console.log(checkKey);
            if (checkKey) events = checkKey;
            else events = [];
        } else {
            //throw error
            events = [];
        }

    }
    if (events) {
        const shouldLoadEvents = config.event_load_strategy !== "sdk";
        const view = {
            data: shouldLoadEvents ? events : [],
            site: config.site,
            tag: config.tag,
            track_web_events: config.track_web_events,
            macros: queryParamsStr,
            platform: platform
        };
        return new Response(
            Mustache.render(
                //IIFE so varaibles & functions are not declared on the window object.
                `//! Copyright ${new Date().getFullYear()} Lytx.io All rights reserved.
(function () {
${
                //Below excludes third-party vendor scripts when tag_manager is disabled
                config.tag_manager
                    ? //Third-party vendor scripts enabled (tag_manager = true)
                    `
const ${dataVariableName} =  [
  {{#data}}
  {
    event_name: "{{{event_name}}}",
    QuantcastPixelId:"{{QuantcastPixelId}}",
    QuantCastPixelLabel:"{{QuantCastPixelLabel}}",
    SimplfiPixelid:"{{SimplfiPixelid}}",
    googleanalytics:"{{googleanalytics}}",
    googleadsscript:"{{googleadsscript}}",
    googleadsconversion:'{{{googleadsconversion}}}',
    metaEvent:"{{metaEvent}}",
    linkedinEvent:"{{linkedinEvent}}",
    clickCease:"{{clickCease}}",
    condition: "{{condition}}",
    data_passback: "{{data_passback}}",
    parameters: '{{{parameters}}}',
    paramConfig:"{{paramConfig}}",
    query_parameters:"{{query_parameters}}",
    customScript:"{{customScript}}",
    rules: "{{rules}}",
    Notes:"{{Notes}}",
  },
  {{/data}}
];`
                    : //Third-party vendor scripts disabled (tag_manager = false)
                    `
const ${dataVariableName} =  [
  {{#data}}
  {
    event_name: "{{{event_name}}}",
    condition: "{{condition}}",
    data_passback: "{{data_passback}}",
    parameters: '{{{parameters}}}',
    paramConfig:"{{paramConfig}}",
    query_parameters:"{{query_parameters}}",
    rules: "{{rules}}",
    Notes:"{{Notes}}",
  },
  {{/data}}
];
    `}
if(window.${dataVariableName}){
  window.${dataVariableName}.push(
  {site:"{{site}}",tag:"{{tag}}",events:${dataVariableName},tracked:[]}
  )
}else{
  window.${dataVariableName} = [
  {site:"{{site}}",tag:"{{tag}}",events:${dataVariableName},tracked:[]}
  ]
} 
${config.tag_manager ? script_tag_manager : script_core}

parseData(${dataVariableName},{site:"{{site}}",tag:"{{tag}}"},${config.track_web_events},'{{platform}}');

${config.track_web_events ? `trackEvents("{{tag}}",'{{platform}}',null,'{{{macros}}}');` : ``}
})();
`,
                view
            ),
            {
                headers: {
                    "Content-Type": "text/javascript",
                },
            });
    } else {
        return new Response("Not Found.", { status: 404 });
    }
}]);


/**
 *
 * GET /trackWebEvent
 *
 * This is the track web event endpoint
 */
export const trackWebEvent = (adapter: DBAdapter) => route("/trackWebEvent", [corsMiddleware, async ({ request, cf }) => {
    if (request.method != "POST") return new Response("Not Found.", { status: 404 });
    const url = new URL(request.url);
    const headers = request.headers;
    const account = url.searchParams.get("account");
    const platform = url.searchParams.get("platform") ?? "web";



    // const account = c.req.query("account");
    // const platform = c.req.query("platform");
    //add zod
    const data =
        platform == "tv"
            ? ((await request.json()) as {
                event: WebEvent["event"] | Record<"custom", string>;
                custom_data: Record<string, string>;
                client_page_url: string;
                referer?: string;
                screen_width?: number;
                screen_height?: number;
                browser?: string;
                operating_system?: string;
                rid?: string;
                device_type?: string;
            })
            : ((await request.json()) as {
                referer: string;
                event: WebEvent["event"] | Record<"custom", string>;
                client_page_url: string;
                screen_width: number;
                screen_height: number;
                browser?: string;
                operating_system?: string;
                rid?: string;
                device_type?: string;
                custom_data?: Record<string, string>;
            });
    const eventName = typeof data.event == "object" ? data.event.custom : data.event;
    const isRuleDefinitionEvent = eventName === "auto_capture" && data.custom_data?.type === "auto_capture";
    if (isRuleDefinitionEvent) {
        return new Response(JSON.stringify({ error: null, status: 200, rid: null, skipped: true }), {
            headers: {
                "Content-Type": "application/json",
            },
        });
    }
    //console.log(data);
    //get tag id
    if (account && platform) {

        const checkAccouuntByTagId = await getSiteForTag(account);

        if (checkAccouuntByTagId && checkAccouuntByTagId.track_web_events) {
            const clientUrl = platform == "web" ? new URL(data.client_page_url) : data.client_page_url;
            const queryParams: Record<string, string> = {};

            if (platform == "web" && typeof clientUrl == "object") {
                clientUrl.searchParams.forEach((value, key) => {
                    if (
                        !blockedQueryParams.find((query) =>
                            query.includes(key.toLowerCase())
                        )
                    ) {
                        queryParams[key] = value;
                    }
                });
            }

            const parsedDeviceData = parseUserAgent(headers.get("User-Agent")!);

            const cf = request.cf as IncomingRequestCfProperties | undefined;

            //WARNING: Forcing the type here until we migrate account --> team_id
            const team_id = checkAccouuntByTagId.account_id!;

            const recordData: WebEvent = {
                page_url: headers.get("referer") ?? "Unknown",
                referer: data.referer,
                screen_height: data.screen_height,
                screen_width: data.screen_width,
                client_page_url:
                    platform == "web" ? (typeof clientUrl != "string" ? clientUrl.pathname : "") : data.client_page_url,
                //!check platform here
                browser:
                    platform == "tv"
                        ? data.browser
                        : parseBrowser(parsedDeviceData, headers.get("User-Agent")!),
                operating_system:
                    platform == "tv"
                        ? data.operating_system
                        : parseOs(parsedDeviceData, headers.get("sec-ch-ua-platform")!),
                device_type:
                    platform == "tv"
                        ? data.device_type
                        : parseDeviceType(
                            parsedDeviceData,
                            headers.get("sec-ch-ua-mobile")!
                        ),
                bot_data:
                    (parsedDeviceData.bot as unknown as Record<string, string>) ??
                    undefined,
                country: cf?.country ?? undefined,
                region: cf?.region ?? undefined,
                city: cf?.city ?? undefined,
                postal: cf?.postalCode ?? undefined,
                event: platform == "web" ? "page_view" : "screen_view",
                tag_id: account,
                //FIX: THIS IS TEMPORARY
                account_id: team_id,
                team_id: team_id,
                site_id: checkAccouuntByTagId.site_id,
                query_params: queryParams,
                rid: platform == "tv" ? data.rid : null,
                custom_data: data.custom_data,
            };

            // let lat = cf ? cf!.latitude as string : null
            if (eventName) {
                recordData.event = eventName as WebEvent["event"];
            }

            //console.log(recordData,checkAccouuntByTagId.data.gdpr);

            if (checkAccouuntByTagId.gdpr) {

                const newEvent = await insertSiteEvent(recordData);
                return new Response(JSON.stringify({ error: null, status: 200 }), {
                    headers: {
                        "Content-Type": "application/json",
                    },
                })
                // c.json({ error: newEvent.error, status: newEvent.status });
            } else {
                //extra data allowed in non gdpr sites
                //goes to us db

                //TODO: Add cron to update salt
                const ridVal = await hashIpAddress(headers.get("x-real-ip")!, checkAccouuntByTagId.rid_salt!)
                recordData.rid = ridVal;
                const newEvent = await insertSiteEvent(recordData);


                return new Response(JSON.stringify({ error: null, status: 200, rid: ridVal }), {
                    headers: {
                        "Content-Type": "application/json",
                    },
                });
                // c.json({ error: newEvent.error, status: newEvent.status, rid: ridVal });
            }

        } else return new Response("Not Found.", { status: 404 });
    } else return new Response("Not Found.", { status: 404 });

    //sec-ch-ua-platform Windows
    //user-agent
    //sec-ch-ua-mobile
    //referer PATH

}]);



/**
 * POST /api/sites
 *
 * This is the new site setup endpoint
 */
export const newSiteSetup = (internal = true) =>
    route("/sites", async ({ request, ctx }: RequestInfo<any, AppContext>) => {

        let team_id: number | null = null;
        if (!internal) {
            //TODO: Grab api key from request
            const apiKey = request.headers.get("x-api-key");
            if (!apiKey) return new Response("Missing API Key", { status: 400 });
            // team_id = await getTeamIdFromApiKey(apiKey);
            if (!team_id) return new Response("Invalid API Key", { status: 400 });
        } else team_id = ctx.team.id;

        if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
        // const site_stub = env.SITE_DURABLE_OBJECT.get(ctx.)

        const body = await request.json() as {
            name: string,
            domain: string,
            track_web_events: boolean,
            gdpr: boolean,
            autocapture?: boolean,
            event_load_strategy?: "sdk" | "kv"
        };
        if (body.name && body.domain) {
            const { name, domain, gdpr, track_web_events, autocapture, event_load_strategy } = body;
            const site = await createSite({
                name,
                domain,
                track_web_events,
                gdpr,
                autocapture: autocapture ?? true,
                event_load_strategy: event_load_strategy ?? "sdk",
                team_id: team_id ?? 0
            });
            return new Response(JSON.stringify(site), { status: 200 });
        } else {
            return new Response("Invalid request body.", { status: 400 });
        }
    });
