import type { Platform, webEvent } from "./trackWebEvents";
import { trackEvents } from "./trackWebEvents";
import type { GoogleConversionParams, GoogleEvent, GoogleCommand, } from "./vendors/google";
import { googleTagScript, googleConversion, manualGoogleConversion } from "./vendors/google";
import { quantcastScript } from "./vendors/quantcast";
import { simplfiScript } from "./vendors/simplfi";
import { metaScript } from "./vendors/meta";
import { linkedinScript } from "./vendors/linkedin";
import { clickCeaseScript } from "./vendors/clickcease";

export interface LytxEvent {
  lytxAccount?: string;
  labels?: string;
}
type SiteConfig = { site: string, tag: string };



declare global {
  interface Window {
    _lytxEvents: LytxEvent[] | pageEvent[];
    dataLayer: Array<unknown>;
    _qevents: { qacct: string, labels: string }[];
    gtag_lytx: Function;
    gtag?: Function;
    fbq?: (method: 'track' | 'trackCustom' | 'init', event: string, customParams?: Record<string, unknown>) => void;
    _fbq: Function;
    lintrk?: Function;
    _linkedin_data_partner_ids?: Array<any>
    lytxApi: {
      emit: Function;
      event: Function;
      rid: Function;
      debugMode: boolean;
      platform: Platform;
      currentSiteConfig: SiteConfig;
      trackCustomEvents: Function;
      track_web_events: boolean
    }
    lytxDataLayer: Array<{
      site: string,
      tag: string,
      events: [],
      tracked: Array<string | Record<string, string> | pageEvent>
      rid: null | string;
    }>
  }
}

export type rule =
  | "starts with"
  | "does not contain"
  | "ends with"
  | "equals"
  | "contains"
  | "click"
  | "hover"
  | "is visible"
  | "submit"
  | "swipe";

export type condition =
  | "path"
  | "dom element"
  | "domain"
  | "element"
  | "form field filled";

export type eventName =
  | "View Content"
  | "Search"
  | "Add To Wishlist"
  | "Add To Cart"
  | "Initiate Checkout"
  | "Add Payment Info"
  | "Purchase"
  | "Lead"
  | "Register"
  | "Start Trial"
  | "Subscribe"
  | "Submit Application"
  | "Custom"
  | "Thank You Page"
  | "Page Visit"
  | "Submit/Complete";

/*export type dataPassback =
  | "Revenue"
  | "Order Id"
  | "Customer Type"
  | "Product Category"
  | "Other";*/

export type dataPassback = {
  element: string,
  value: string
}

export type paramOptionsKey = "querySelectorAll" | "path" | "fullpath" | 'delay' | 'iframe';
export type paramaOptionsValue = number | string | boolean;
export type paramConfig = Record<paramOptionsKey, paramaOptionsValue>;

//TODO: Refactor this type into having a tag_manager type which has vendor specific types
export interface pageEvent {
  Notes: string;
  QuantcastPixelId?: string;
  QuantCastPixelLabel?: string;
  SimplfiPixelid?: string;
  googleanalytics?: string;
  googleadsscript?: string;
  googleadsconversion?: string;
  metaEvent?: string;
  linkedinEvent?: string;
  clickCease?: "enabled" | "disabled";
  condition: condition;
  data_passback?: string;//JSON
  event_name: eventName;
  parameters: string;
  paramConfig: string;
  query_parameters?: string;
  customScript?: string;
  rules: rule;
  //!BLINK X Product
  personalization?: Array<userInteraction>;
  //!Personalization type --> JSON
}

export interface userOption {
  //This can be a page url, or manually defined ie by a title of a product "Maple" 
  category: string;
  //Can relate to another page or element
  relatesTo: string;
}

export interface userInteraction {
  //what to track
  rule: rule;
  //if this is false dont record
  record: boolean;
  //custom relations to use for UI
  options: userOption
}





function createScriptElement(src: string, async: boolean, type?: string) {
  const script = document.createElement("script");
  script.src = src;
  script.async = async;
  let scriptPlacement = document.head.children[0];
  if (!scriptPlacement) {
    scriptPlacement = document.getElementsByTagName("script")[0];
  }
  if (type) {
    script.type = type;
  }
  scriptPlacement.parentNode!.insertBefore(script, scriptPlacement);
}





function decodeHtmlEntities(str: string) {
  return str.replaceAll(/&#39;/g, "'")
    .replaceAll(/&quot;/g, '"')
    .replaceAll(/&gt;/g, '>')
    .replaceAll(/&lt;/g, '<')
    .replaceAll(/&amp;/g, '&');
}
function customScript(script: string) {
  //eval?
  if (window.lytxApi.debugMode) {
    console.info('Custom script is : ', script);
  }
  try {
    let parsedScript = decodeHtmlEntities(script);
    const createCustomScript = document.createElement('script');

    createCustomScript.innerHTML = parsedScript;

    const scriptPlacement = document.getElementsByTagName("script")[0];

    scriptPlacement.parentNode!.insertBefore(createCustomScript, scriptPlacement);
  } catch (error) {
    console.error(error);
  }

}
function handleIframe(config: { callback: { func: Function, arguments?: Array<any> }, element: HTMLElement, debug: boolean, name: string }) {
  window.addEventListener('blur', function() {
    window.setTimeout(function() {
      if (config.element && document.activeElement instanceof HTMLIFrameElement) {
        if (config.debug) {
          console.log('Debug Iframe element is : ', config.element, document.activeElement);
        }
        if (config.callback && document.activeElement == config.element) {
          if (config.debug) console.log(config.element, `Iframe Has been tracked correctly event name is ${config.name ?? ''}`);
          if (config.callback.arguments) {
            config.callback.func(...config.callback.arguments);
          } else {
            config.callback.func();
          }
        }
      }
    }, 0);
  });
}

function splitQueryParams(
  split: string[] | string,
  queryParams: URLSearchParams,
  skipSmallSplit = false) {
  let keys: {
    key: string;
    val: string;
  }[]

  if (!skipSmallSplit && typeof (split) != 'string') {
    keys = split.map((values) => {
      let smallSplit = values.split('=');
      return { key: smallSplit[0], val: smallSplit[1] }
    })
  } else if (skipSmallSplit && typeof (split) == 'string') {
    let smallSplit = split.split('=');
    keys = [
      {
        key: smallSplit[0],
        val: smallSplit[1]
      }
    ]
  }


  let allowed = true;
  queryParams.forEach((val, key) => {
    let check = keys.find((value) => value.key == key && value.val == val);

    if (!check) allowed = false;
  })

  return allowed
}

function updateEventRecord(trackedEvent: Record<string, string> | pageEvent) {
  //trackCustomEvents(config.tag,)
  if (window.lytxDataLayer && window.lytxDataLayer.length > 1) {
    window.lytxDataLayer.find((layer) => layer.tag == window.lytxApi.currentSiteConfig.tag)?.tracked.push(trackedEvent);
  } else {
    window.lytxDataLayer[0].tracked.push(trackedEvent);
  }
}
function trackCustomRecord(event: pageEvent) {
  if (window.lytxApi.track_web_events) {
    window.lytxApi.trackCustomEvents(window.lytxApi.currentSiteConfig.tag, window.lytxApi.platform, { custom: event.event_name });
    if (window.lytxApi.debugMode) {
      console.trace('Event tracked is', event.event_name);
    }
  }
}

/*function handlePersonalization(siteTag : string){
    // --> call api here
    //trackInteraction
    //similar to trackevent
    //!this will only run if personzalit exists on the json event
    //deal with the return data here
    //Draw HTMLELEMNTS on the MIRAGE WEBSITE
    //Take the Blink css/html or JSON and then replace data so its relavent to the user
  }*/

//

function handleThirdPartyConfigScripts(ev: pageEvent) {
  const { metaEvent, linkedinEvent, SimplfiPixelid, googleadsscript, googleanalytics, clickCease, QuantcastPixelId, googleadsconversion } = ev;
  if (metaEvent) {
    metaScript({ metaId: ev.metaEvent, scriptInit: true });
  }
  if (linkedinEvent) {
    linkedinScript(linkedinEvent);
  }
  if (SimplfiPixelid) {
    const newScript = simplfiScript(SimplfiPixelid);
    createScriptElement(newScript.src, newScript.async);
  }
  if (googleanalytics) {
    const newScript = googleTagScript(googleanalytics);
    createScriptElement(newScript.src, true);
    newScript.callBack(newScript.id);
  }
  if (QuantcastPixelId) {
    const newScript = quantcastScript();
    createScriptElement(newScript.src, true);
    newScript.callBack(QuantcastPixelId);
  }
  if (clickCease && clickCease == "enabled") {
    const newScript = clickCeaseScript();
    createScriptElement(
      newScript.src,
      newScript.async,
      newScript.type
    );
  }
  if (googleadsscript) {
    const newScript = googleTagScript(googleadsscript);
    createScriptElement(newScript.src, true);
    newScript.callBack(newScript.id);
  }
  if (ev.customScript) {
    customScript(ev.customScript);
  }
  //WARNING: This is a hacky way to handle google conversions consider manualconversion
  if (googleadsconversion) {
    try {
      const parsedValue = JSON.parse(googleadsconversion) as GoogleConversionParams[];

      parsedValue.forEach((val) =>
        googleConversion(val.GoogleCommand, val.id, val.type, val.value)
      );
    } catch (error) {
      console.log(error);
    }
  }

}

function handleParameters(ev: pageEvent) {
  const { parameters } = ev;
  if (parameters.startsWith(".")) {
    return parameters;
  }
  if (parameters.startsWith("#")) {
    return parameters;
  }
  return `[${ev.parameters}]`;
}
/**@deprecated**/
function handleAction(callback: Function, delay: boolean, amount: number) {
  //Maybe dont allow delay to be longer than 10000ms
  if (delay) {
    setTimeout(() => {
      callback();
    }, amount < 10000 ? amount : 2000);
  } else {
    callback();
  }
}

function waitForAllElements(selector: string, callback: (elements: Array<Element>) => void, options = {
  timeout: 10000,
  targetNode: document.body,
  observerOptions: { childList: true, subtree: true }
}) {
  // Check if element already exists
  const nodes = document.querySelectorAll(selector);
  const elements = Array.from(nodes);
  if (elements.length > 0) {
    callback(elements);
    if (window.lytxApi.debugMode) {
      console.log(`Element list found for ${selector} see list here`, elements);
    }
    return;
  }
  if (window.lytxApi.debugMode) {
    console.log(`Element list not found for ${selector}`);
  }

  // Set a timeout limit
  const timeoutId = setTimeout(() => {
    if (observer) observer.disconnect();
  }, options.timeout);

  // Throttle checking to avoid excessive processing
  let throttled = false;
  const checkForElement = () => {
    if (throttled) return;
    throttled = true;

    setTimeout(() => {
      const nodes = document.querySelectorAll(selector);
      const elements = Array.from(nodes);

      if (elements.length > 0) {
        if (window.lytxApi.debugMode) {
          console.log(`Element list found for ${selector} after initial delay see list here`, elements);
        }
        observer.disconnect();
        clearTimeout(timeoutId);
        callback(elements);
      }
      throttled = false;
    }, 50);
  };

  // Start observer
  const observer = new MutationObserver(checkForElement);
  observer.observe(options.targetNode, options.observerOptions);
}

function waitForElement(selector: string, callback: (element: Element) => void, options = {
  timeout: 10000,
  targetNode: document.body,
  observerOptions: { childList: true, subtree: true }
}) {
  // Check if element already exists
  const element = document.querySelector(selector);
  if (element) {
    callback(element);
    if (window.lytxApi.debugMode) {
      console.log(`Element found for ${selector}`, element);
    }
    return;
  }
  if (window.lytxApi.debugMode) {
    console.log(`Element not found for ${selector}`);
  }

  // Set a timeout limit
  const timeoutId = setTimeout(() => {
    if (observer) observer.disconnect();
  }, options.timeout);

  // Throttle checking to avoid excessive processing
  let throttled = false;
  const checkForElement = () => {
    if (throttled) return;
    throttled = true;

    setTimeout(() => {
      const element = document.querySelector(selector);
      if (element) {
        if (window.lytxApi.debugMode) {
          console.log(`Element found for ${selector} after initial delay`, element);
        }
        observer.disconnect();
        clearTimeout(timeoutId);
        callback(element);
      }
      throttled = false;
    }, 50);
  };

  // Start observer
  const observer = new MutationObserver(checkForElement);
  observer.observe(options.targetNode, options.observerOptions);
}

function handleInteraction(
  ev: pageEvent,
  // type: "interaction" | "url",
  // el: HTMLElement
) {
  const { metaEvent, linkedinEvent, SimplfiPixelid, googleadsscript, googleanalytics, clickCease, QuantcastPixelId, QuantCastPixelLabel, googleadsconversion } = ev;

  updateEventRecord(ev);
  trackCustomRecord(ev);

  if (metaEvent) {
    metaScript({ metaId: ev.metaEvent, eventName: ev.event_name });
  }
  if (linkedinEvent) {
    if (linkedinEvent != undefined) linkedinScript(linkedinEvent);

  }
  if (SimplfiPixelid) {
    const newScript = simplfiScript(SimplfiPixelid);
    createScriptElement(newScript.src, newScript.async);

  }
  if (googleanalytics) {
  }
  if (QuantcastPixelId && QuantCastPixelLabel) {
    const newQEvent = quantcastScript(QuantCastPixelLabel);
    newQEvent.callBack(QuantcastPixelId);

  }
  if (clickCease && clickCease == "enabled") {
  }
  if (googleadsscript) {
  }
  if (googleadsconversion) {
    try {
      const parsedValue = JSON.parse(
        googleadsconversion
      ) as GoogleConversionParams[];
      for (const val of parsedValue) {
        manualGoogleConversion(val.id, { value: val.value });
      }
    } catch (error) {
      console.warn(error);
    }


  }
}

function handleRule(ev: pageEvent, type: "interaction" | "url") {
  const { rules, paramConfig } = ev;

  let queryAll = false;
  // let queryAllWithIndex = false;


  /**@deprecated**/
  const delay = { enabled: false, amount: 0 };
  let iframe = false;
  let allElems: NodeListOf<HTMLElement> | null = null;
  let elem: Element | null = null;
  let parseConfig: paramConfig | null = null;

  //CONSIDER: Limiting or debounce clicks
  let clicked = false;
  //WARNING: Need to check if this is only for interactions
  const elemParams = handleParameters(ev);


  //PERF: Do this upfront with error handling
  if (paramConfig) {
    const checkConfig = handleParseConfig(ev);
    parseConfig = checkConfig.parseConfig;
    iframe = checkConfig.iframe;
    delay.amount = checkConfig.delay.amount;
    delay.enabled = checkConfig.delay.enabled;
    if (parseConfig) {
      //PERF: This is if user wants one event to manage many elements
      if (parseConfig.querySelectorAll) {
        //TODO: Handle if path is include as it affects the querySelectorAll
        //if (parseConfig.path) 
        // if (parseConfig.path) {
        //                       const path = window.location.pathname;
        //                       if (path.includes(`${parseConfig.path}`) || parseConfig.path == '*') {
        //                         if (parseConfig.querySelectorAll == 'all') {
        //                           queryAll = true;
        //                           allElems = document.querySelectorAll(`[${ev.parameters}]`);
        //                           if (debug) {
        //                             console.log(`🐛🐛🐛 ${ev.event_name} has the following elements tracked`, allElems);
        //                           }
        //                         } else {
        //                           //@ts-ignore
        //                           elem = document.querySelectorAll(`[${ev.parameters}]`)[parseConfig.querySelectorAll];
        //                         }
        //
        //                       }
        //                     }
        if (parseConfig.querySelectorAll == 'all') {
          queryAll = true;
        }
      }
    }
  }
  //TODO: Handle if iframe 
  // try {
  //                             if (iframe) {
  //                               handleIframe({
  //                                 name: ev.event_name,
  //                                 callback: {
  //                                   func: googleSingleClickConversion,
  //                                   arguments: [elem, parsedValue]
  //                                   //@ts-ignore
  //                                 }, element: elem, debug: debug
  //                               })
  //                             }
  //                           }

  if (rules == "click") {
    //PERF: We need to check if elem exists and other elems exist
    if (queryAll) {
      waitForAllElements(elemParams, (elements) => {
        elements.forEach((element, index) => {
          if (parseConfig && typeof parseConfig.querySelectorAll != "boolean" && typeof parseConfig.querySelectorAll != "string") {
            let querySelecIndex = parseConfig.querySelectorAll
            if (querySelecIndex != index) return;
          }
          element.addEventListener('click', () => {
            handleInteraction(ev);
          });
        });
      });
    } else {
      waitForElement(elemParams, (element) => {
        element.addEventListener("click", () => {
          handleInteraction(ev);
        });
      });
    }

  }
  if (rules == "submit") {
    waitForElement(elemParams, (element) => {
      element.addEventListener("submit", () => {
        handleInteraction(ev);
      });
    });
  }

}

/**
 * This function handles the paramConfig and returns the parseConfig, iframe, and delay
 * 
 **/
function handleParseConfig(ev: pageEvent) {
  const { paramConfig } = ev;

  let parseConfig: paramConfig | null = null;
  let iframe = false;
  /**@deprecated**/
  const delay = { enabled: false, amount: 0 };

  if (paramConfig) {
    try {
      if (ev.paramConfig.includes('&quot;')) {
        //TODO: Handle this better
        let rawStr = ev.paramConfig.replaceAll('&quot;', '"');
        // if (window.lytxApi.debugMode) { console.log(rawStr, SON.parse(rawStr)) };
        parseConfig = JSON.parse(rawStr);
      } else {
        parseConfig = JSON.parse(ev.paramConfig) as paramConfig;
      }
    } catch (error) {
      console.warn(error);
    }
    if (parseConfig) {
      if (parseConfig.delay) {
        delay.amount = Number(parseConfig.delay);
        delay.enabled = true;
        // if (window.lytxApi.debugMode) { console.log(`Delay of ${delay.amount} has been enabled for : ${ev.event_name}`) }
      }
      if (parseConfig.iframe) {
        iframe = true;
      }
    }
  }
  return { parseConfig, iframe, delay };
}

function handleCondition(ev: pageEvent, url: URL) {
  const { condition, parameters } = ev;
  if (window.lytxApi.debugMode) {
    console.info(`Handling condition for condition ${ev.condition} and event ${ev.event_name}`);
  }
  //TODO: Clean up Path section
  if (condition == "path") {
    //PERF: This is mainly the best catchall for all pages/wildcards
    if (parameters == "*") {
      handleThirdPartyConfigScripts(ev);
    } else {
      const parsedUrl = url ?? new URL(window.location.href);
      const path = (url && url.pathname) ? url.pathname : window.location.pathname;
      const queryParams = parsedUrl.searchParams;
      let queryParamCheck = true;

      try {
        if (ev.query_parameters) {
          if (ev.query_parameters.includes('&')) {
            //do something
            let split = ev.query_parameters.split('&');
            queryParamCheck = splitQueryParams(split, queryParams);
          } else {
            queryParamCheck = splitQueryParams(ev.query_parameters, queryParams);
          }
        }
      } catch (error) {
        queryParamCheck = true;
      }

      if (path.includes(ev.parameters) && queryParamCheck) {
        if (ev.SimplfiPixelid) {
          const newScript = simplfiScript(ev.SimplfiPixelid);
          createScriptElement(newScript.src, newScript.async);

          //window._lytxEvents.push(ev);
          updateEventRecord(ev);
        }
        if (ev.QuantcastPixelId && ev.QuantCastPixelLabel) {
          const newQEvent = quantcastScript(ev.QuantCastPixelLabel);
          newQEvent.callBack(ev.QuantcastPixelId);
        }
        if (ev.googleadsconversion) {
          try {
            //GoogleCommand :GoogleCommand,id:string,type:GoogleEvent,value?:string
            const parsedValue = JSON.parse(ev.googleadsconversion) as GoogleConversionParams[];

            parsedValue.forEach((val) =>
              googleConversion(
                val.GoogleCommand,
                val.id,
                val.type,
                val.value
              )
            );
          } catch (error) {
            console.log(error);
          }
        }
      }

    }
  } else if (condition == "dom element" || condition == "element") {
    handleRule(ev, "interaction");
  } else if (condition == "form field filled") {

  }
}

export function parseData(
  data: pageEvent[] | null = null,
  config: SiteConfig,
  // trackCustomEvents: (account: string, platformName: Platform, event: webEvent['event'] | Record<'custom', string> | null) => void,
  track_web_events: boolean,
  platformName: Platform
) {

  const pageUrl = new URL(window.location.href);
  const debug = pageUrl.searchParams.has('lytxDebug');
  if (window.lytxDataLayer.length < 2) {
    console.log(`Lytx script is working 🔥🔥🔥${debug ? '🐛🐛🐛 debug enabled' : ''}`);
  }

  function loadLytxEvents(url: URL = new URL(window.location.href)) {
    if (data) {
      if (window.lytxDataLayer.length < 2) {
        console.log(
          "⚡⚡⚡⚡ See Defined Lytx Events Here ⚡⚡⚡⚡ -->",
          window.lytxDataLayer
        );
      }
      try {
        for (const ev of data) {
          handleCondition(ev, url);
        }
      } catch (error) {
        console.log(error);
      }

    }
  }
  window.lytxApi = {
    emit: loadLytxEvents,
    event: trackEvents,
    debugMode: debug,
    platform: platformName,
    currentSiteConfig: config,
    track_web_events: track_web_events,
    trackCustomEvents: trackEvents,
    rid: () => {
      if (window.lytxDataLayer) {
        let ridVal = null;
        window.lytxDataLayer.forEach((layer) => {
          if (layer.rid) {
            ridVal = layer.rid;
          }
        });
        return ridVal;
      } else {
        return null;
      }
    }
  }
  loadLytxEvents();
}
