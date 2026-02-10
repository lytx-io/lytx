/**
 * Lytx Script - Shared Module
 * 
 * Contains types, utilities, and core functions shared between
 * the full (tag_manager) and core versions of the script.
 */
import type { Platform } from "./trackWebEvents";
import { trackEvents } from "./trackWebEvents";

// ============================================================================
// Types
// ============================================================================

export interface LytxEvent {
  lytxAccount?: string;
  labels?: string;
}

export type SiteConfig = { site: string, tag: string, autocapture?: boolean };

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

export type dataPassback = {
  element: string,
  value: string
}

export type paramOptionsKey = "querySelectorAll" | "path" | "fullpath" | 'delay' | 'iframe';
export type paramaOptionsValue = number | string | boolean;
export type paramConfig = Record<paramOptionsKey, paramaOptionsValue>;

/** Core PageEvent - fields common to both versions */
export interface PageEventCore {
  Notes: string;
  condition: condition;
  data_passback?: string;
  event_name: eventName;
  parameters: string;
  paramConfig: string;
  query_parameters?: string;
  rules: rule;
  personalization?: Array<userInteraction>;
}

/** Full PageEvent - includes third-party vendor fields */
export interface PageEvent extends PageEventCore {
  QuantcastPixelId?: string;
  QuantCastPixelLabel?: string;
  SimplfiPixelid?: string;
  googleanalytics?: string;
  googleadsscript?: string;
  googleadsconversion?: string;
  metaEvent?: string;
  linkedinEvent?: string;
  clickCease?: "enabled" | "disabled";
  customScript?: string;
}

export interface userOption {
  category: string;
  relatesTo: string;
}

export interface userInteraction {
  rule: rule;
  record: boolean;
  options: userOption
}

// ============================================================================
// Global Window Declaration
// ============================================================================

declare global {
  interface Window {
    _lytxEvents: LytxEvent[] | PageEvent[];
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
      capture: (eventName: string, customData?: Record<string, string>) => void;
      track_web_events: boolean;
      /** Tracks manually captured events to avoid autocapture duplicates */
      _manualCaptures: Set<string>;
    }
    lytxDataLayer: Array<{
      site: string,
      tag: string,
      events: [],
      tracked: Array<string | Record<string, string> | PageEvent>
      rid: null | string;
    }>
  }
}

// ============================================================================
// DOM Utilities
// ============================================================================

export function createScriptElement(src: string, async: boolean, type?: string) {
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

export function decodeHtmlEntities(str: string) {
  return str.replaceAll(/&#39;/g, "'")
    .replaceAll(/&quot;/g, '"')
    .replaceAll(/&gt;/g, '>')
    .replaceAll(/&lt;/g, '<')
    .replaceAll(/&amp;/g, '&');
}

export function customScript(script: string) {
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

// ============================================================================
// Query Parameter Utilities
// ============================================================================

export function splitQueryParams(
  split: string[] | string,
  queryParams: URLSearchParams,
  skipSmallSplit = false
) {
  let keys: { key: string; val: string; }[] = [];

  if (!skipSmallSplit && typeof (split) != 'string') {
    keys = split.map((values) => {
      let smallSplit = values.split('=');
      return { key: smallSplit[0], val: smallSplit[1] }
    })
  } else if (skipSmallSplit && typeof (split) == 'string') {
    let smallSplit = split.split('=');
    keys = [{ key: smallSplit[0], val: smallSplit[1] }]
  }

  let allowed = true;
  queryParams.forEach((val, key) => {
    let check = keys.find((value) => value.key == key && value.val == val);
    if (!check) allowed = false;
  })

  return allowed
}

// ============================================================================
// Event Record Utilities
// ============================================================================

export function updateEventRecord(trackedEvent: Record<string, string> | PageEvent | PageEventCore) {
  if (window.lytxDataLayer && window.lytxDataLayer.length > 1) {
    window.lytxDataLayer.find((layer) => layer.tag == window.lytxApi.currentSiteConfig.tag)?.tracked.push(trackedEvent as any);
  } else {
    window.lytxDataLayer[0].tracked.push(trackedEvent as any);
  }
}

export function trackCustomRecord(event: PageEvent | PageEventCore) {
  if (window.lytxApi.track_web_events) {
    window.lytxApi.trackCustomEvents(
      window.lytxApi.currentSiteConfig.tag,
      window.lytxApi.platform,
      { custom: event.event_name },
      "",
      {
        type: "custom",
        name: event.event_name,
        condition: event.condition,
        rules: event.rules,
        parameters: event.parameters,
      }
    );
    if (window.lytxApi.debugMode) {
      console.trace('Event tracked is', event.event_name);
    }
  }
}

// ============================================================================
// Parameter Handling
// ============================================================================

export function handleParameters(ev: PageEvent | PageEventCore) {
  const { parameters } = ev;
  if (parameters.startsWith(".")) {
    return parameters;
  }
  if (parameters.startsWith("#")) {
    return parameters;
  }
  return `[${ev.parameters}]`;
}

export function handleParseConfig(ev: PageEvent | PageEventCore) {
  const { paramConfig } = ev;

  let parseConfig: paramConfig | null = null;
  let iframe = false;
  const delay = { enabled: false, amount: 0 };

  if (paramConfig) {
    try {
      if (ev.paramConfig.includes('&quot;')) {
        let rawStr = ev.paramConfig.replaceAll('&quot;', '"');
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
      }
      if (parseConfig.iframe) {
        iframe = true;
      }
    }
  }
  return { parseConfig, iframe, delay };
}

// ============================================================================
// DOM Observer Utilities
// ============================================================================

export function waitForAllElements(
  selector: string,
  callback: (elements: Array<Element>) => void,
  options = {
    timeout: 10000,
    targetNode: document.body,
    observerOptions: { childList: true, subtree: true }
  }
) {
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

  const timeoutId = setTimeout(() => {
    if (observer) observer.disconnect();
  }, options.timeout);

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

  const observer = new MutationObserver(checkForElement);
  observer.observe(options.targetNode, options.observerOptions);
}

export function waitForElement(
  selector: string,
  callback: (element: Element) => void,
  options = {
    timeout: 10000,
    targetNode: document.body,
    observerOptions: { childList: true, subtree: true }
  }
) {
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

  const timeoutId = setTimeout(() => {
    if (observer) observer.disconnect();
  }, options.timeout);

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

  const observer = new MutationObserver(checkForElement);
  observer.observe(options.targetNode, options.observerOptions);
}

// ============================================================================
// Autocapture Utilities
// ============================================================================

/** Generate a unique key for an element to track duplicates */
function getElementKey(element: HTMLElement, eventType: string): string {
  const text = element.textContent?.trim().slice(0, 50) || '';
  const href = (element as HTMLAnchorElement).href || '';
  const id = element.id || '';
  const className = element.className || '';
  return `${eventType}:${text}:${href}:${id}:${className}`;
}

/** Get descriptive text for an element */
function getElementText(element: HTMLElement): string {
  // For links/buttons, prefer aria-label, then text content
  return (
    element.getAttribute('aria-label') ||
    element.textContent?.trim().slice(0, 100) ||
    element.getAttribute('title') ||
    ''
  );
}

/** Get element type description */
function getElementType(element: HTMLElement): string {
  const tagName = element.tagName.toLowerCase();
  if (tagName === 'a') return 'link';
  if (tagName === 'button') return 'button';
  if (tagName === 'input') {
    const type = (element as HTMLInputElement).type;
    if (type === 'submit') return 'submit_button';
    if (type === 'button') return 'button';
  }
  if (tagName === 'form') return 'form';
  return tagName;
}

/** Initialize autocapture for clicks and form submissions */
function initAutocapture(config: SiteConfig, platformName: Platform) {
  const debug = window.lytxApi?.debugMode;
  
  // Track which elements have been captured in this session to avoid rapid duplicates
  const capturedThisSession = new Set<string>();
  
  if (debug) {
    console.log('🎯 Lytx Autocapture enabled');
  }

  // Capture clicks on links and buttons
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    
    // Find the closest interactive element
    const anchor = target.closest('a') as HTMLAnchorElement | null;
    const button = target.closest('button, input[type="submit"], input[type="button"]') as HTMLElement | null;
    
    const element = anchor || button;
    if (!element) return;

    const elementType = getElementType(element);
    const elementText = getElementText(element);
    const elementKey = getElementKey(element, 'click');
    
    // Skip if this exact interaction was just captured (debounce rapid clicks)
    if (capturedThisSession.has(elementKey)) {
      if (debug) {
        console.log('🎯 Autocapture skipped (duplicate):', elementType, elementText);
      }
      return;
    }
    
    // Build event name with element info: $ac_link_ElementText_elementId
    // Sanitize text for event name (remove special chars, limit length)
    const sanitizedText = elementText
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .trim()
      .slice(0, 30)
      .replace(/\s+/g, ' ');
    
    const elementId = element.id || null;
    const eventNameParts = [`$ac`, elementType, sanitizedText || 'unnamed'];
    if (elementId) {
      eventNameParts.push(elementId);
    }
    const eventName = eventNameParts.join('_');

    // Check if user has manually captured this event name - if so, skip autocapture
    if (window.lytxApi._manualCaptures.has(eventName)) {
      if (debug) {
        console.log('🎯 Autocapture skipped (manual capture exists):', eventName);
      }
      return;
    }

    // Mark as captured (with TTL to allow re-capture after some time)
    capturedThisSession.add(elementKey);
    setTimeout(() => capturedThisSession.delete(elementKey), 1000);

    const customData: Record<string, string> = {
      autocapture: 'true',
      element_type: elementType,
      element_text: elementText,
      page_path: window.location.pathname,
      page_url: window.location.href,
    };

    // Add href for links
    if (anchor?.href) {
      customData.link_url = anchor.href;
    }

    // Add element identifiers if available
    if (elementId) {
      customData.element_id = elementId;
    }
    if (element.className && typeof element.className === 'string') {
      customData.element_classes = element.className.split(' ').slice(0, 5).join(' ');
    }

    if (debug) {
      console.log('🎯 Autocapture click:', eventName, customData);
    }

    trackEvents(config.tag, platformName, { custom: eventName }, "", customData);
  }, true); // Use capture phase to get events before they might be stopped

  // Capture form submissions
  document.addEventListener('submit', (e) => {
    const form = e.target as HTMLFormElement;
    if (!form || form.tagName.toLowerCase() !== 'form') return;

    const formName = form.getAttribute('name') || form.id || 'unnamed_form';
    const formAction = form.action || window.location.href;
    const elementKey = getElementKey(form, 'submit');

    // Skip if this exact form was just submitted
    if (capturedThisSession.has(elementKey)) {
      if (debug) {
        console.log('🎯 Autocapture skipped (duplicate form submit):', formName);
      }
      return;
    }

    // Build event name with form info: $ac_form_FormName_formId
    const sanitizedFormName = formName
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .trim()
      .slice(0, 30)
      .replace(/\s+/g, ' ');
    
    const formId = form.id || null;
    const eventNameParts = ['$ac', 'form', sanitizedFormName || 'unnamed'];
    if (formId && formId !== formName) {
      eventNameParts.push(formId);
    }
    const eventName = eventNameParts.join('_');

    if (window.lytxApi._manualCaptures.has(eventName)) {
      if (debug) {
        console.log('🎯 Autocapture skipped (manual capture exists):', eventName);
      }
      return;
    }

    capturedThisSession.add(elementKey);
    setTimeout(() => capturedThisSession.delete(elementKey), 1000);

    const customData: Record<string, string> = {
      autocapture: 'true',
      element_type: 'form',
      form_name: formName,
      form_action: formAction,
      form_method: form.method || 'get',
      page_path: window.location.pathname,
      page_url: window.location.href,
    };

    if (formId) {
      customData.element_id = formId;
    }

    if (debug) {
      console.log('🎯 Autocapture form submit:', eventName, customData);
    }

    trackEvents(config.tag, platformName, { custom: eventName }, "", customData);
  }, true);
}

// ============================================================================
// Main parseData Function
// ============================================================================

export function createParseData(
  handleCondition: (ev: PageEvent | PageEventCore, url: URL) => void,
  versionLabel: string = ""
) {
  return function parseData(
    data: (PageEvent | PageEventCore)[] | null = null,
    config: SiteConfig,
    track_web_events: boolean,
    platformName: Platform
  ) {
    const pageUrl = new URL(window.location.href);
    const debug = pageUrl.searchParams.has('lytxDebug');
    if (window.lytxDataLayer.length < 2) {
      console.log(`Lytx script is working 🔥🔥🔥${debug ? '🐛🐛🐛 debug enabled' : ''}${versionLabel}`);
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

    // Track manual captures to avoid autocapture duplicates
    const manualCaptures = new Set<string>();

    window.lytxApi = {
      emit: loadLytxEvents,
      event: trackEvents,
      capture: (eventName: string, customData?: Record<string, string>) => {
        // Track this as a manual capture to prevent autocapture duplication
        manualCaptures.add(eventName);
        trackEvents(config.tag, platformName, { custom: eventName }, "", customData);
      },
      debugMode: debug,
      platform: platformName,
      currentSiteConfig: config,
      track_web_events: track_web_events,
      trackCustomEvents: trackEvents,
      _manualCaptures: manualCaptures,
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

    // Initialize autocapture if enabled
    if (config.autocapture && track_web_events) {
      initAutocapture(config, platformName);
    }
  }
}
