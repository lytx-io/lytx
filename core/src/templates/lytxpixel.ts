/**
 * Lytx Script - Full Version (With Third-Party Vendors)
 * 
 * This version includes all third-party vendor integrations.
 * Use this when tag_manager is enabled.
 */
import {
  type PageEvent,
  type paramConfig,
  createScriptElement,
  customScript,
  updateEventRecord,
  trackCustomRecord,
  handleParameters,
  handleParseConfig,
  waitForAllElements,
  waitForElement,
  splitQueryParams,
  createParseData,
} from "./lytx-shared";

// Re-export types for external use
export type { PageEvent, LytxEvent, rule, condition, eventName, dataPassback, paramConfig, userInteraction } from "./lytx-shared";

// Vendor imports
import type { GoogleConversionParams } from "./vendors/google";
import { googleTagScript, googleConversion, manualGoogleConversion } from "./vendors/google";
import { quantcastScript } from "./vendors/quantcast";
import { simplfiScript } from "./vendors/simplfi";
import { metaScript } from "./vendors/meta";
import { linkedinScript } from "./vendors/linkedin";
import { clickCeaseScript } from "./vendors/clickcease";

// ============================================================================
// Vendor-specific handlers
// ============================================================================

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

function handleThirdPartyConfigScripts(ev: PageEvent) {
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
    createScriptElement(newScript.src, newScript.async, newScript.type);
  }
  if (googleadsscript) {
    const newScript = googleTagScript(googleadsscript);
    createScriptElement(newScript.src, true);
    newScript.callBack(newScript.id);
  }
  if (ev.customScript) {
    customScript(ev.customScript);
  }
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

function handleInteraction(ev: PageEvent) {
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
    // Google Analytics handled elsewhere
  }
  if (QuantcastPixelId && QuantCastPixelLabel) {
    const newQEvent = quantcastScript(QuantCastPixelLabel);
    newQEvent.callBack(QuantcastPixelId);
  }
  if (clickCease && clickCease == "enabled") {
    // ClickCease handled elsewhere
  }
  if (googleadsscript) {
    // Google Ads Script handled elsewhere
  }
  if (googleadsconversion) {
    try {
      const parsedValue = JSON.parse(googleadsconversion) as GoogleConversionParams[];
      for (const val of parsedValue) {
        manualGoogleConversion(val.id, { value: val.value });
      }
    } catch (error) {
      console.warn(error);
    }
  }
}

function handleRule(ev: PageEvent, type: "interaction" | "url") {
  const { rules, paramConfig } = ev;

  let queryAll = false;
  const delay = { enabled: false, amount: 0 };
  let iframe = false;
  let parseConfig: paramConfig | null = null;

  const elemParams = handleParameters(ev);
  if (window.lytxApi.debugMode) {
    console.debug("Auto-capture rule registered", { rule: rules, selector: elemParams, event_name: ev.event_name });
  }

  if (paramConfig) {
    const checkConfig = handleParseConfig(ev);
    parseConfig = checkConfig.parseConfig;
    iframe = checkConfig.iframe;
    delay.amount = checkConfig.delay.amount;
    delay.enabled = checkConfig.delay.enabled;
    if (parseConfig) {
      if (parseConfig.querySelectorAll) {
        if (parseConfig.querySelectorAll == 'all') {
          queryAll = true;
        }
      }
    }
  }

  if (rules == "click") {
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

function handleCondition(ev: PageEvent, url: URL) {
  const { condition, parameters } = ev;
  if (window.lytxApi.debugMode) {
    console.info(`Handling condition for condition ${ev.condition} and event ${ev.event_name}`);
  }

  if (condition == "path") {
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
          updateEventRecord(ev);
        }
        if (ev.QuantcastPixelId && ev.QuantCastPixelLabel) {
          const newQEvent = quantcastScript(ev.QuantCastPixelLabel);
          newQEvent.callBack(ev.QuantcastPixelId);
        }
        if (ev.googleadsconversion) {
          try {
            const parsedValue = JSON.parse(ev.googleadsconversion) as GoogleConversionParams[];
            parsedValue.forEach((val) =>
              googleConversion(val.GoogleCommand, val.id, val.type, val.value)
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
    // Form field filled handler
  }
}

// ============================================================================
// Export parseData and trackEvents
// ============================================================================

export const parseData = createParseData(handleCondition, "");
export { trackEvents } from "./trackWebEvents";
