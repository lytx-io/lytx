/**
 * These are GDPR,CCPA Privacy compliant web events
 */
export interface WebEvent {
  /**We track the page URL of each page view on your website. 
  * We use this to show you which pages have been viewed and how many 
  * times a particular page has been viewed.

  * The hostname and path are collected. 
  * Query parameters are discarded, except for these special query parameters: 
  * ref=, source=, utm_source=, utm_medium=, utm_campaign=, utm_content= and utm_term=. 
  */
  page_url?: string;
  /**
   * We use the referrer string to show you the number of
   * visitors referred to your website from links on other sites.
   */
  referer?: string;
  /**
   * We use this to show you what browsers and browser version numbers
   * people use when visiting your website.
   * This is derived from the User-Agent HTTP header.
   * The full User-Agent is discarded.
   */
  browser?: string;
  /**
   * We use this to show you what operating systems people use when visiting your website.
   * We show the brand of the operating system and the version number.
   * This is derived from the User-Agent HTTP header.
   * The full User-Agent is discarded.
   */
  operating_system?: string;
  /**
   * We use this to show you what devices people use when visiting your website.
   * Devices are categorized into desktop, mobile or tablet.
   * This is derived from the User-Agent HTTP header.
   * The full User-Agent is discarded.
   */
  device_type?: string;
  /**
   * We look up the visitor’s location using their IP address.
   * We do not track anything more granular than the city level
   * and the IP address of the visitor is discarded.
   * We never store IP addresses in our database or logs.
   */
  country?: IncomingRequestCfProperties["country"];
  region?: IncomingRequestCfProperties["region"];
  city?: IncomingRequestCfProperties["city"];
  postal?: IncomingRequestCfProperties["postalCode"];
  /**
   * Random string hash to count uniques
   * Old salts are deleted every 24 hours to avoid the possibility of
   * linking visitor information from one day to the next.
   * Forgetting used salts also removes the possibility of the original
   * IP addresses being revealed in a brute-force attack.
   * The raw IP address and User-Agent are rendered completely inaccessible to anyone,
   * including ourselves.
   *
   * hash(daily_salt + website_domain + ip_address + user_agent)
   */
  rid?: string | null;
  /**
   * Page event
   */
  event?: "page_view" | "form_fill" | "phone_call " | "screen_view";
  tag_id?: string;
  client_page_url?: string;
  screen_width?: number;
  screen_height?: number;
  /**@deprecated**/
  account_id?: number;
  team_id?: number;
  site_id?: number;
  query_params?: Record<string, string>;
  bot_data?: Record<string, string>;
  custom_data?: Record<string, string>;
}

export const blockedQueryParams = [
  "order",
  "email",
  "credit",
  "name",
  "phone",
  "number",
  "user",
  "pay",
  "sha",
  "card",
  "credit",
  "pass",
];

//Record<'custom',string>

//this function works on a website

//we need it to work on a tv

export type Platform = "tv" | "web" | "app" | "other";

type TrackEventPayload = Omit<WebEvent, "event"> & {
  event?: WebEvent["event"] | Record<"custom", string>;
};

export function trackEvents(
  account: string,
  platformName: Platform = "web",
  event: WebEvent["event"] | Record<"custom", string> | null = null,
  macros: string,
  customData?: Record<string, string>
) {
  let data: TrackEventPayload = {};
  const macrosObj: Record<string, string> = {};
  const safeCustomData = customData && Object.keys(customData).length > 0
    ? customData
    : undefined;
  //if tv
  if (platformName == "tv") {
    //const macroUrl = new URL(`https://www.lytx.io?${macros}`);
    const macrosArr = macros.split("&");
    macrosArr.forEach((element) => {
      const [key, value] = element.split("=");
      macrosObj[key] = value;
    });
    data = {
      custom_data: safeCustomData ?? (macrosObj || undefined),
      client_page_url: macrosObj["client_page_url"] || undefined,
      event: event ?? "screen_view",
      screen_height:
        Number(macrosObj["screen_height"].replace(/\D/g, "")) || undefined,
      screen_width:
        Number(macrosObj["screen_width"].replace(/\D/g, "")) || undefined,
      rid: macrosObj["rid"] || undefined,
      browser: macrosObj["browser"] || undefined,
      operating_system: macrosObj["operatingSytem"] || undefined,
      device_type: macrosObj["deviceType"] || undefined,
    };
  }
  else {
    data = {
      referer: document.referrer,
      event: event ?? "page_view",
      client_page_url: window.location.href,
      screen_height: window.screen.height,
      screen_width: window.screen.width,
      custom_data: safeCustomData,
    };
  }

  (async () => {
    // __LYTX_DOMAIN__ is replaced at runtime by the tag API
    const lytxDomain = "__LYTX_DOMAIN__";
    const req = await window.fetch(
      `${lytxDomain}/trackWebEvent.v2?account=${account}&platform=${platformName}`,
      {
        method: "POST",
        body: JSON.stringify(data),
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (req.ok) {
      const resp = await req.json() as { error: null | boolean, status: number, rid: string };
      //console.log(resp);
      if (window.lytxDataLayer && resp.rid) {
        window.lytxDataLayer[0].rid = resp.rid;
      }

      // error: newEvent.error, status: newEvent.status, rid:ridVal
    }
  })();

  //check platfrom
}
