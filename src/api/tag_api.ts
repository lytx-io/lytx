import { route } from "rwsdk/router";
import { RequestInfo } from "rwsdk/worker";
import { env } from "cloudflare:workers";
import { parseBrowser, parseOs, parseDeviceType, parseUserAgent } from "@/utilities/detector";
import type { AppContext } from "@/worker";
import { getClient } from "@db/client";
//Load these into more general function that reads from adapter type
import { getSiteForTag, insertSiteEvent } from "@db/d1/sites";
import {
    type pageEvent,
    // type LytxEvent,
    // type paramConfig,
} from "@/templates/lytxpixel";


//WARNING: The generator script needs to be run before deployin
import { lytxPixelRawJsString } from "@/generated/lytxpixelRaw";


import { blockedQueryParams, webEvent, } from "@/templates/trackWebEvents";


import Mustache from "mustache";
import { hashIpAddress } from "@/utilities";
import { createSite } from "@db/d1/sites";
import { DBAdapter } from "@db/d1/schema";

export const dataVariableName = "lytxDataLayer" as const;

const encodePixel =
    "R0lGODlhAQABAIAAANvf7wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";
export const decodedPixel = atob(encodePixel);



//WARNING: This only needs to be used on tag routes for third party sites
export function corsMiddleware({ headers, request }: RequestInfo) {

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
 *
 * GET /lytx.js
 *
 * This is the lytx.js endpoint main tag
 */
export const lytxTag = (adapter: DBAdapter) => route("/lytx.js", [corsMiddleware, async ({ request }) => {
    if (request.method != "GET") return new Response("Not Found.", { status: 404 });
    const url = new URL(request.url);

    //TODO: wire this up with adapter functions
    const client = getClient(adapter);

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

    let events: null | pageEvent[] = null;
    const config = { site: "", tag: "", track_web_events: false, gdpr: false };
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
            config.tag = checkAccouuntByTagId.tag_id;
            config.track_web_events = checkAccouuntByTagId.track_web_events;
            config.gdpr = checkAccouuntByTagId.gdpr ?? false;
        } else {
            //throw an error
            console.log('🔥🔥🔥 No account found for ', account);
        }
        if (accountKey) {
            const checkKey = (await env.LYTX_EVENTS.get(accountKey, {
                type: "json",
            })) as unknown as pageEvent[];
            //console.log(checkKey);
            if (checkKey) events = checkKey;
            else events = [];
        } else {
            //throw error
            events = [];
        }

    }
    if (events) {
        const view = {
            data: events,
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
                //Below is GDPR, CCPA etc compliant
                config.gdpr
                    ? `
const ${dataVariableName} =  [
  {{#data}}
  {
    event_name: "{{{event_name}}}",
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
];
    `

                    : //Below is allowed with consent management in place or outside of GDPR,CCPA etc
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
];`}
if(window.${dataVariableName}){
  window.${dataVariableName}.push(
  {site:"{{site}}",tag:"{{tag}}",events:${dataVariableName},tracked:[]}
  )
}else{
  window.${dataVariableName} = [
  {site:"{{site}}",tag:"{{tag}}",events:${dataVariableName},tracked:[]}
  ]
} 
${lytxPixelRawJsString}

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
export const trackWebEvent = (adapter: DBAdapter) => route("/trackWebEvent", [corsMiddleware, async ({ request, cf, headers }) => {
    if (request.method != "GET") return new Response("Not Found.", { status: 404 });
    const url = new URL(request.url);

    const account = url.searchParams.get("account");
    const platform = url.searchParams.get("platform") ?? "web";



    // const account = c.req.query("account");
    // const platform = c.req.query("platform");
    //add zod
    const data =
        platform == "tv"
            ? ((await request.json()) as {
                event: webEvent["event"] | Record<"custom", string>;
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
                event: webEvent["event"] | Record<"custom", string>;
                client_page_url: string;
                screen_width: number;
                screen_height: number;
                browser?: string;
                operating_system?: string;
                rid?: string;
                device_type?: string;
                custom_data?: Record<string, string>;
            });
    //console.log(data);
    //get tag id
    if (account && platform) {

        const checkAccouuntByTagId = await getSiteForTag(account);

        if (checkAccouuntByTagId && checkAccouuntByTagId.track_web_events) {
            const clientUrl = platform == "web" ? new URL(data.client_page_url) : data.client_page_url;
            const queryParams: Array<Record<string, string>> = [];

            if (platform == "web" && typeof clientUrl == "object") {
                clientUrl.searchParams.forEach((value, key) => {
                    if (
                        !blockedQueryParams.find((query) =>
                            query.includes(key.toLowerCase())
                        )
                    ) {
                        queryParams.push({ key, value });
                    }
                });
            }

            const parsedDeviceData = parseUserAgent(headers.get("User-Agent")!);

            const cf = request.cf as IncomingRequestCfProperties | undefined;

            const recordData: webEvent = {
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
                account_id: checkAccouuntByTagId.team_id!,
                site_id: checkAccouuntByTagId.site_id,
                query_params: queryParams,
                rid: platform == "tv" ? data.rid : null,
                custom_data: data.custom_data,
            };

            // let lat = cf ? cf!.latitude as string : null
            if (typeof data.event == "object") {
                recordData.event = data.event.custom as webEvent["event"];
            } else {
                recordData.event = data.event;
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
export const newSiteSetup = route<RequestInfo<any, AppContext>>("/sites", async ({ request, ctx }) => {
    if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

    const body = await request.json() as {
        name: string,
        domain: string,
        track_web_events: boolean,
        gdpr: boolean
    };
    if (body.name && body.domain) {
        const { name, domain, gdpr, track_web_events } = body;
        const site = await createSite({ name, domain, track_web_events, gdpr, team_id: ctx.team! });
        return new Response(JSON.stringify(site), { status: 200 });
    } else {
        return new Response("Invalid request body.", { status: 400 });
    }
});


