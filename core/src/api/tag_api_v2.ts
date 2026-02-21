import { route } from "rwsdk/router";
import type { RequestInfo } from "rwsdk/worker";
import { env } from "cloudflare:workers";
import type { PageEvent } from "@/templates/lytxpixel";
import { script_tag_manager, script_core } from "virtual:lytx-pixel-raw";
// import { getSiteForTag as getSiteForTagPg } from "@db/postgres/sites";
import { getSiteForTag as getSiteForTagD1, rotateSiteRidSalt } from "@db/d1/sites";
import { insertSiteEvents } from "@db/adapter";
import { enqueueSiteEventsForProcessing } from "@/api/queueWorker";
import { blockedQueryParams, WebEvent } from "@/templates/trackWebEvents";
import { parseBrowser, parseOs, parseDeviceType, parseUserAgent } from "@/utilities/detector";
import { hashIpAddress } from "@/utilities";
import type { DBAdapter } from "@db/types";
import { IS_DEV } from "rwsdk/constants";
import { SiteEventInput } from "@/session/siteSchema";

export const dataVariableName = "lytxDataLayer" as const;

export function corsMiddleware({ response }: RequestInfo) {
  const headers = response.headers;
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  headers.set("Access-Control-Allow-Headers", "X-Custom-Header, Upgrade-Insecure-Requests, Content-Type");
  headers.set("Access-Control-Expose-Headers", "Content-Length, X-Kuma-Revision");
  headers.set("Access-Control-Max-Age", "600");
  headers.set("Access-Control-Allow-Credentials", "false");
}
//TODO: move to seprate 
function checkIfTagManager(events: PageEvent[], allowed = false) {
  const eventsMapped = [];
  for (const ev of events) {
    if (allowed) {
      eventsMapped.push({
        event_name: ev.event_name,
        QuantcastPixelId: ev.QuantcastPixelId,
        QuantCastPixelLabel: ev.QuantCastPixelLabel,
        SimplfiPixelid: ev.SimplfiPixelid,
        googleanalytics: ev.googleanalytics,
        googleadsscript: ev.googleadsscript,
        googleadsconversion: ev.googleadsconversion,
        metaEvent: ev.metaEvent,
        linkedinEvent: ev.linkedinEvent,
        clickCease: ev.clickCease,
        condition: ev.condition,
        data_passback: ev.data_passback,
        parameters: ev.parameters,
        paramConfig: ev.paramConfig,
        query_parameters: ev.query_parameters,
        customScript: ev.customScript,
        rules: ev.rules,
        Notes: ev.Notes,
      })
    } else {
      eventsMapped.push({
        event_name: ev.event_name,
        condition: ev.condition,
        data_passback: ev.data_passback,
        parameters: ev.parameters,
        paramConfig: ev.paramConfig,
        query_parameters: ev.query_parameters,
        rules: ev.rules,
        Notes: ev.Notes,
      })
    }
  }
  return eventsMapped

}

export const lytxTag = (adapter: DBAdapter, route_path = "/lytx.js") => route(route_path, [corsMiddleware, async ({ request }) => {
  if (request.method !== "GET") return new Response("Not Found.", { status: 404 });
  const url = new URL(request.url);
  const lytxDomain = url.origin;

  const accountRaw = url.searchParams.get("account");
  const account = typeof accountRaw === "string" ? accountRaw : undefined;
  const platformName = "web" as const;

  const macros = Array.from(url.searchParams.entries())
    .filter(([k]) => k !== "account" && k !== "platform")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  let events: PageEvent[] | null = null;
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
    const checkAccouuntByTagId = await getSiteForTagD1(account as string);

    let accountKey: string | undefined;
    if (checkAccouuntByTagId) {
      accountKey = (checkAccouuntByTagId.tag_id_override ?? checkAccouuntByTagId.tag_id) || undefined;
      config.site = checkAccouuntByTagId.domain ?? "";
      config.tag = checkAccouuntByTagId.tag_id as string;
      config.track_web_events = checkAccouuntByTagId.track_web_events;
      config.tag_manager = checkAccouuntByTagId.tag_manager ?? false;
      config.gdpr = checkAccouuntByTagId.gdpr ?? false;
      config.autocapture = checkAccouuntByTagId.autocapture ?? false;
      config.event_load_strategy = (checkAccouuntByTagId.event_load_strategy ?? "sdk") as "sdk" | "kv";
    } else {
      //TODO: Save this in a kv so i can check later for legacy sites
      if (IS_DEV) console.log("🔥🔥🔥 No account found for ", account);
    }
    if (accountKey && config.event_load_strategy !== "sdk") {
      const checkKey = (await env.LYTX_EVENTS.get(accountKey, { type: "json" })) as unknown as PageEvent[];
      events = checkKey ? checkKey : [];
    } else {
      events = [];
    }
  }
  ///trackWebEvent
  const lytx_script = (lytxDomain: string) => {
    // Use core bundle (no vendors) when tag_manager is disabled, full bundle otherwise
    const baseScript = config.tag_manager ? script_tag_manager : script_core;
    // Replace the placeholder with the actual domain (includes protocol)
    const domain = IS_DEV ? "http://localhost:6123" : lytxDomain;
    return baseScript.replace("__LYTX_DOMAIN__", domain);
  }
  if (!events) return new Response("Not Found.", { status: 404 });
  const eventsOut = checkIfTagManager(events, config.tag_manager);
  const shouldLoadEvents = config.event_load_strategy !== "sdk";
  const safeEvents = shouldLoadEvents ? eventsOut : [];

  const siteCfg = { site: config.site, tag: config.tag, autocapture: config.autocapture };
  const script = `//! Copyright ${new Date().getFullYear()} Lytx All rights reserved.
(function () {
 const ${dataVariableName} = ${JSON.stringify(safeEvents)};
 if (window.${dataVariableName}) {
   window.${dataVariableName}.push({site:${JSON.stringify(config.site)},tag:${JSON.stringify(config.tag)},events:${dataVariableName},tracked:[]});
 } else {
   window.${dataVariableName} = [{site:${JSON.stringify(config.site)},tag:${JSON.stringify(config.tag)},events:${dataVariableName},tracked:[]}];
 }
 ${lytx_script(lytxDomain)}
  parseData(${dataVariableName}, ${JSON.stringify(siteCfg)}, ${JSON.stringify(!!config.track_web_events)}, "web");
 ${config.track_web_events ? `trackEvents(${JSON.stringify(config.tag)}, "web", null, ${JSON.stringify(macros)});` : ``}
 })();`;

  return new Response(script, { headers: { "Content-Type": "text/javascript" } });
}]);

type TrackWebEventOptions = {
  useQueue?: boolean;
};

export const trackWebEvent = (
  adapter: DBAdapter,
  route_path = "/trackWebEvent",
  options: TrackWebEventOptions = {},
) => route(route_path, [corsMiddleware, async ({ request }) => {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }
  if (request.method !== "POST") return new Response("Not Found.", { status: 404 });
  const url = new URL(request.url);

  const account = url.searchParams.get("account");
  const data = (await request.json()) as {
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
  };

  if (!account) return new Response("Not Found.", { status: 404 });

  // Use D1 for admin/site info (source of truth)
  const site = await getSiteForTagD1(account);
  if (!site || !site.track_web_events) return new Response("Not Found.", { status: 404 });
  const siteAdapter = (site.site_db_adapter ?? adapter) as DBAdapter;
  const shouldUseQueue = options.useQueue ?? false;

  const eventName = (typeof data.event === "object" ? data.event.custom : (data.event ?? "page_view")) as string;
  const isRuleDefinitionEvent = eventName === "auto_capture" && data.custom_data?.type === "auto_capture";
  if (isRuleDefinitionEvent) {
    if (IS_DEV) console.log("🔥🔥🔥 Skipping auto_capture rule definition event");
    return new Response(JSON.stringify({ error: null, status: 200, rid: null, queued: false, skipped: true }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  // Build query params safely (web only)
  const clientUrl = new URL(data.client_page_url);
  const queryParams: Record<string, string> = {};

  //PERF: check if this is the best way to do this later
  clientUrl.searchParams.forEach((value: string, key: string) => {
    if (!blockedQueryParams.find((q) => q.includes(key.toLowerCase()))) {
      queryParams[key] = value;
    }
  });

  const ua = request.headers.get("User-Agent") || "";
  const parsedUA = parseUserAgent(ua);

  const siteEvent: SiteEventInput = {
    page_url: request.headers.get("referer") ?? "Unknown",
    referer: data.referer,
    screen_height: data.screen_height,
    screen_width: data.screen_width,
    client_page_url: typeof clientUrl !== "string" ? clientUrl.pathname : "",
    browser: parseBrowser(parsedUA, ua),
    operating_system: parseOs(parsedUA, request.headers.get("sec-ch-ua-platform") || ""),
    device_type: parseDeviceType(parsedUA, request.headers.get("sec-ch-ua-mobile") || ""),
    // bot_data: parsedUA.bot as any,
    country: (request.cf as IncomingRequestCfProperties | undefined)?.country ?? undefined,
    region: (request.cf as IncomingRequestCfProperties | undefined)?.region ?? undefined,
    city: (request.cf as IncomingRequestCfProperties | undefined)?.city ?? undefined,
    postal: (request.cf as IncomingRequestCfProperties | undefined)?.postalCode ?? undefined,
    event: eventName as string,
    tag_id: account,
    query_params: queryParams,
    custom_data: data.custom_data,
  };

  let rid: string | null = null;
  if (site.gdpr) {
    rid = data.rid ?? null;
  } else {
    const rawExpire = site.rid_salt_expire ? new Date(site.rid_salt_expire) : null;
    const isExpired = !rawExpire || Number.isNaN(rawExpire.getTime()) || rawExpire <= new Date();
    const rotated = isExpired ? await rotateSiteRidSalt(site.site_id) : null;
    const ridSalt = rotated?.rid_salt ?? site.rid_salt ?? null;
    const ipAddress =
      request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-real-ip") ||
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "";
    if (ipAddress && ridSalt) {
      rid = await hashIpAddress(ipAddress, ridSalt);
    } else if (data.rid) {
      rid = data.rid;
    }
  }
  if (rid) {
    siteEvent.rid = rid;
  }

  if (shouldUseQueue) {
    try {
      if (IS_DEV) console.log("🔥🔥🔥 Enqueueing site event for processing");
      await enqueueSiteEventsForProcessing({
        siteId: site.site_id,
        siteUuid: site.uuid,
        teamId: site.team_id,
        adapter: siteAdapter,
        events: [siteEvent],
      });
    } catch (error) {
      console.error("🔥🔥🔥 Queue enqueue failed", { error: error instanceof Error ? error.message : "queue enqueue failed" });
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : "queue enqueue failed",
        status: 500,
      }), {
        headers: { "Content-Type": "application/json" },
        status: 500,
      });
    }

    return new Response(JSON.stringify({ error: null, status: 200, rid, queued: true }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  const result = await insertSiteEvents(site.site_id, site.uuid, [siteEvent], siteAdapter);
  if (!result.success) {
    return new Response(JSON.stringify({ error: result.error ?? "insert failed", status: 500 }), {
      headers: { "Content-Type": "application/json" }, status: 500
    });
  }

  return new Response(JSON.stringify({ error: null, status: 200, rid, queued: false }), {
    headers: { "Content-Type": "application/json" }
  });
}]);
