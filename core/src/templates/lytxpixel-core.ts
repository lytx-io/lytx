/**
 * Lytx Script - Core Version (No Third-Party Vendors)
 * 
 * This version excludes all third-party vendor integrations.
 * Use this when tag_manager is disabled.
 */
import {
  type PageEventCore,
  type paramConfig,
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
export type { PageEventCore as PageEvent } from "./lytx-shared";

// ============================================================================
// Core-specific handlers (no vendor calls)
// ============================================================================

function handleThirdPartyConfigScripts(ev: PageEventCore) {
  // Third-party vendor scripts are disabled in core version
  if (window.lytxApi.debugMode) {
    console.debug('Third-party vendor scripts disabled (core version)');
  }
}

function handleInteraction(ev: PageEventCore) {
  updateEventRecord(ev);
  trackCustomRecord(ev);
  // No vendor calls in core version
}

function handleRule(ev: PageEventCore, type: "interaction" | "url") {
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

function handleCondition(ev: PageEventCore, url: URL) {
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
        updateEventRecord(ev);
        // No vendor calls in core version
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

export const parseData = createParseData(handleCondition, " (core version - no third-party vendors)");
export { trackEvents } from "./trackWebEvents";
