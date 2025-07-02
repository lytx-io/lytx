// This file is auto-generated. Do not edit it directly.
// Contains the raw JavaScript string of lytxpixel.ts (transpiled).

export const lytxPixelRawJsString: string = `var __defProp = Object.defineProperty;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};

// src/templates/trackWebEvents.ts
function trackEvents(account, platformName = "web", event = null, macros) {
  let data = {};
  const macrosObj = {};
  if (platformName == "tv") {
    const macrosArr = macros.split("&");
    macrosArr.forEach((element) => {
      const [key, value] = element.split("=");
      macrosObj[key] = value;
    });
    data = {
      custom_data: macrosObj || void 0,
      client_page_url: macrosObj["client_page_url"] || void 0,
      event: event != null ? event : "screen_view",
      screen_height: Number(macrosObj["screen_height"].replace(/\\D/g, "")) || void 0,
      screen_width: Number(macrosObj["screen_width"].replace(/\\D/g, "")) || void 0,
      rid: macrosObj["rid"] || void 0,
      browser: macrosObj["browser"] || void 0,
      operating_system: macrosObj["operatingSytem"] || void 0,
      device_type: macrosObj["deviceType"] || void 0
    };
  } else {
    data = {
      referer: document.referrer,
      event: event != null ? event : "page_view",
      client_page_url: window.location.href,
      screen_height: window.screen.height,
      screen_width: window.screen.width
    };
  }
  (async () => {
    const req = await window.fetch(
      \`https://lytx.io/trackWebEvent?account=\${account}&platform=\${platformName}\`,
      // \`/trackWebEvent?account=\${account}&platform=\${platformName}\`,
      {
        method: "POST",
        body: JSON.stringify(data),
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
    if (req.ok) {
      const resp = await req.json();
      if (window.lytxDataLayer) {
        if (resp.status == 201) {
          window.lytxDataLayer[0].rid = resp.rid;
        }
      }
    }
  })();
}

// src/templates/vendors/google.ts
function googleTagScript(id) {
  return {
    async: true,
    src: \`https://www.googletagmanager.com/gtag/js?id=\${id}\`,
    id,
    callBack: (id2) => {
      window.dataLayer = window.dataLayer || [];
      if (window.gtag_lytx) {
        const gtag_lytx = function() {
          window.dataLayer.push(arguments);
        };
        window.gtag_lytx = gtag_lytx;
        gtag_lytx("config", /* @__PURE__ */ new Date());
        gtag_lytx("config", id2);
      } else {
        const gtagScript = document.createElement("script");
        gtagScript.innerHTML = \`
          window.dataLayer = window.dataLayer || [];
          function gtag_lytx(){window.dataLayer.push(arguments);}
          gtag_lytx('js', new Date());

          gtag_lytx('config', '\${id2}');
          \`;
        const scriptTags = document.head.querySelectorAll("script");
        let scriptPlacement = document.head.children[0];
        if (scriptTags) {
          const scripts = [...scriptTags];
          const activeGscript = scripts.filter((val) => val.src.includes(\`id=\${id2}\`));
          try {
            scriptPlacement = activeGscript[0].nextSibling;
          } catch (error) {
            console.log(error);
          }
        }
        if (!scriptPlacement) {
          scriptPlacement = document.getElementsByTagName("script")[0];
        }
        scriptPlacement.parentNode.insertBefore(gtagScript, scriptPlacement);
      }
    }
  };
}
function manualGoogleConversion(send_to, options) {
  function gtag_report_conversion(url) {
    var callback = function() {
      if (typeof url != "undefined") {
        window.location = url;
      }
    };
    window.gtag_lytx("event", "conversion", __spreadValues({
      "send_to": send_to,
      "event_callback": callback
    }, options));
    return false;
  }
  gtag_report_conversion();
}
function googleConversion(GoogleCommand, id, type, value) {
  const options = {};
  if (GoogleCommand == "config") {
    if (window.lytxApi.debugMode) {
      console.log("Google Event is : ", type, GoogleCommand, id, value);
    }
    options[\`\${type}\`] = value;
    try {
      if (window.gtag_lytx) {
        window.gtag_lytx(GoogleCommand, id, options);
      } else {
        const gtagScript = document.createElement("script");
        gtagScript.innerHTML = \`
          gtag_lytx('\${GoogleCommand}', '\${id}', {
          '\${type}': '\${value}'
          });
          \`;
        let scriptPlacement = document.head.children[0];
        if (!scriptPlacement) {
          scriptPlacement = document.getElementsByTagName("script")[0];
        }
        scriptPlacement.parentNode.insertBefore(gtagScript, scriptPlacement);
      }
    } catch (error) {
      console.log(error);
    }
  } else if (GoogleCommand == "event") {
    if (window.lytxApi.debugMode) {
      console.log("Google Event is : ", type, GoogleCommand, id, value);
    }
    if (type == "conversion") {
      manualGoogleConversion(id, { value });
    }
  }
}

// src/templates/vendors/quantcast.ts
function quantcastScript(label) {
  return {
    async: true,
    src: (document.location.protocol == "https:" ? "https://secure" : "http://edge") + ".quantserve.com/quant.js",
    element: "script",
    callBack: (id) => {
      window._qevents = window._qevents || [];
      if (window.lytxApi.debugMode) {
        console.log("Quantcast label is : ", label);
      }
      const qStructure = {
        "qacct": id,
        "labels": label != null ? label : "_fp.event.PageView"
      };
      if (label) {
        qStructure.event = "refresh";
      }
      window._qevents.push(qStructure);
    }
  };
}

// src/templates/vendors/simplfi.ts
function simplfiScript(id) {
  return {
    async: true,
    src: \`https://tag.simpli.fi/sifitag/\${id}\`,
    element: "script"
  };
}

// src/templates/vendors/meta.ts
function metaScript(config) {
  const { metaId, eventName, scriptInit } = config;
  let init = scriptInit != null ? scriptInit : false;
  let event = eventName != null ? eventName : "PageView";
  let id = metaId != null ? metaId : "";
  const facebookPixelStandardEvents = [
    "AddPaymentInfo",
    "AddToCart",
    "AddToWishlist",
    "CompleteRegistration",
    "Contact",
    "CustomizeProduct",
    "Donate",
    "FindLocation",
    "InitiateCheckout",
    "Lead",
    "PageView",
    "Purchase",
    "Schedule",
    "Search",
    "StartTrial",
    "SubmitApplication",
    "Subscribe",
    "ViewContent"
  ];
  if (init) {
    !function(f, b, e, v, n, t, s) {
      if (f.fbq)
        return;
      n = f.fbq = function() {
        n.callMethod ? (
          //@ts-expect-error
          n.callMethod.apply(n, arguments)
        ) : n.queue.push(arguments);
      };
      if (!f._fbq)
        f._fbq = n;
      n.push = n;
      n.loaded = true;
      n.version = "2.0";
      n.queue = [];
      t = b.createElement(e);
      t.async = true;
      t.src = v;
      s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    }(
      window,
      document,
      "script",
      "https://connect.facebook.net/en_US/fbevents.js"
    );
  }
  if (window.fbq) {
    if (init) {
      window.fbq("init", \`\${id}\`);
    }
    if (facebookPixelStandardEvents.includes(event)) {
      window.fbq("track", event);
    } else {
      window.fbq("trackCustom", event);
    }
  }
}

// src/templates/vendors/linkedin.ts
function linkedinScript(id) {
  const _linkedin_partner_id = id;
  window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
  window._linkedin_data_partner_ids.push(_linkedin_partner_id);
  (function(l) {
    if (!l) {
      window.lintrk = function(a, b2) {
        window.lintrk.q.push([a, b2]);
      };
      window.lintrk.q = [];
    }
    var s = document.getElementsByTagName("script")[0];
    var b = document.createElement("script");
    b.type = "text/javascript";
    b.async = true;
    b.src = "https://snap.licdn.com/li.lms-analytics/insight.min.js";
    s.parentNode.insertBefore(b, s);
  })(window.lintrk);
}

// src/templates/vendors/clickcease.ts
function clickCeaseScript() {
  return {
    async: true,
    src: "https://www.clickcease.com/monitor/stat.js",
    type: "text/javascript"
  };
}

// src/templates/lytxpixel.ts
function createScriptElement(src, async, type) {
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
  scriptPlacement.parentNode.insertBefore(script, scriptPlacement);
}
function decodeHtmlEntities(str) {
  return str.replaceAll(/&#39;/g, "'").replaceAll(/&quot;/g, '"').replaceAll(/&gt;/g, ">").replaceAll(/&lt;/g, "<").replaceAll(/&amp;/g, "&");
}
function customScript(script) {
  if (window.lytxApi.debugMode) {
    console.info("Custom script is : ", script);
  }
  try {
    let parsedScript = decodeHtmlEntities(script);
    const createCustomScript = document.createElement("script");
    createCustomScript.innerHTML = parsedScript;
    const scriptPlacement = document.getElementsByTagName("script")[0];
    scriptPlacement.parentNode.insertBefore(createCustomScript, scriptPlacement);
  } catch (error) {
    console.error(error);
  }
}
function splitQueryParams(split, queryParams, skipSmallSplit = false) {
  let keys;
  if (!skipSmallSplit && typeof split != "string") {
    keys = split.map((values) => {
      let smallSplit = values.split("=");
      return { key: smallSplit[0], val: smallSplit[1] };
    });
  } else if (skipSmallSplit && typeof split == "string") {
    let smallSplit = split.split("=");
    keys = [
      {
        key: smallSplit[0],
        val: smallSplit[1]
      }
    ];
  }
  let allowed = true;
  queryParams.forEach((val, key) => {
    let check = keys.find((value) => value.key == key && value.val == val);
    if (!check)
      allowed = false;
  });
  return allowed;
}
function updateEventRecord(trackedEvent) {
  var _a;
  if (window.lytxDataLayer && window.lytxDataLayer.length > 1) {
    (_a = window.lytxDataLayer.find((layer) => layer.tag == window.lytxApi.currentSiteConfig.tag)) == null ? void 0 : _a.tracked.push(trackedEvent);
  } else {
    window.lytxDataLayer[0].tracked.push(trackedEvent);
  }
}
function trackCustomRecord(event) {
  if (window.lytxApi.track_web_events) {
    window.lytxApi.trackCustomEvents(window.lytxApi.currentSiteConfig.tag, window.lytxApi.platform, { custom: event.event_name });
    if (window.lytxApi.debugMode) {
      console.trace("Event tracked is", event.event_name);
    }
  }
}
function handleThirdPartyConfigScripts(ev) {
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
  if (googleadsconversion) {
    try {
      const parsedValue = JSON.parse(googleadsconversion);
      parsedValue.forEach(
        (val) => googleConversion(val.GoogleCommand, val.id, val.type, val.value)
      );
    } catch (error) {
      console.log(error);
    }
  }
}
function handleParameters(ev) {
  const { parameters } = ev;
  if (parameters.startsWith(".")) {
    return parameters;
  }
  if (parameters.startsWith("#")) {
    return parameters;
  }
  return \`[\${ev.parameters}]\`;
}
function waitForAllElements(selector, callback, options = {
  timeout: 1e4,
  targetNode: document.body,
  observerOptions: { childList: true, subtree: true }
}) {
  const nodes = document.querySelectorAll(selector);
  const elements = Array.from(nodes);
  if (elements.length > 0) {
    callback(elements);
    if (window.lytxApi.debugMode) {
      console.log(\`Element list found for \${selector} see list here\`, elements);
    }
    return;
  }
  if (window.lytxApi.debugMode) {
    console.log(\`Element list not found for \${selector}\`);
  }
  const timeoutId = setTimeout(() => {
    if (observer)
      observer.disconnect();
  }, options.timeout);
  let throttled = false;
  const checkForElement = () => {
    if (throttled)
      return;
    throttled = true;
    setTimeout(() => {
      const nodes2 = document.querySelectorAll(selector);
      const elements2 = Array.from(nodes2);
      if (elements2.length > 0) {
        if (window.lytxApi.debugMode) {
          console.log(\`Element list found for \${selector} after initial delay see list here\`, elements2);
        }
        observer.disconnect();
        clearTimeout(timeoutId);
        callback(elements2);
      }
      throttled = false;
    }, 50);
  };
  const observer = new MutationObserver(checkForElement);
  observer.observe(options.targetNode, options.observerOptions);
}
function waitForElement(selector, callback, options = {
  timeout: 1e4,
  targetNode: document.body,
  observerOptions: { childList: true, subtree: true }
}) {
  const element = document.querySelector(selector);
  if (element) {
    callback(element);
    if (window.lytxApi.debugMode) {
      console.log(\`Element found for \${selector}\`, element);
    }
    return;
  }
  if (window.lytxApi.debugMode) {
    console.log(\`Element not found for \${selector}\`);
  }
  const timeoutId = setTimeout(() => {
    if (observer)
      observer.disconnect();
  }, options.timeout);
  let throttled = false;
  const checkForElement = () => {
    if (throttled)
      return;
    throttled = true;
    setTimeout(() => {
      const element2 = document.querySelector(selector);
      if (element2) {
        if (window.lytxApi.debugMode) {
          console.log(\`Element found for \${selector} after initial delay\`, element2);
        }
        observer.disconnect();
        clearTimeout(timeoutId);
        callback(element2);
      }
      throttled = false;
    }, 50);
  };
  const observer = new MutationObserver(checkForElement);
  observer.observe(options.targetNode, options.observerOptions);
}
function handleInteraction(ev) {
  const { metaEvent, linkedinEvent, SimplfiPixelid, googleadsscript, googleanalytics, clickCease, QuantcastPixelId, QuantCastPixelLabel, googleadsconversion } = ev;
  updateEventRecord(ev);
  trackCustomRecord(ev);
  if (metaEvent) {
    metaScript({ metaId: ev.metaEvent, eventName: ev.event_name });
  }
  if (linkedinEvent) {
    if (linkedinEvent != void 0)
      linkedinScript(linkedinEvent);
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
      );
      for (const val of parsedValue) {
        manualGoogleConversion(val.id, { value: val.value });
      }
    } catch (error) {
      console.warn(error);
    }
  }
}
function handleRule(ev, type) {
  const { rules, paramConfig } = ev;
  let queryAll = false;
  const delay = { enabled: false, amount: 0 };
  let iframe = false;
  let allElems = null;
  let elem = null;
  let parseConfig = null;
  let clicked = false;
  const elemParams = handleParameters(ev);
  if (paramConfig) {
    const checkConfig = handleParseConfig(ev);
    parseConfig = checkConfig.parseConfig;
    iframe = checkConfig.iframe;
    delay.amount = checkConfig.delay.amount;
    delay.enabled = checkConfig.delay.enabled;
    if (parseConfig) {
      if (parseConfig.querySelectorAll) {
        if (parseConfig.querySelectorAll == "all") {
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
            let querySelecIndex = parseConfig.querySelectorAll;
            if (querySelecIndex != index)
              return;
          }
          element.addEventListener("click", () => {
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
function handleParseConfig(ev) {
  const { paramConfig } = ev;
  let parseConfig = null;
  let iframe = false;
  const delay = { enabled: false, amount: 0 };
  if (paramConfig) {
    try {
      if (ev.paramConfig.includes("&quot;")) {
        let rawStr = ev.paramConfig.replaceAll("&quot;", '"');
        parseConfig = JSON.parse(rawStr);
      } else {
        parseConfig = JSON.parse(ev.paramConfig);
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
function handleCondition(ev, url) {
  const { condition, parameters } = ev;
  if (window.lytxApi.debugMode) {
    console.info(\`Handling condition for condition \${ev.condition} and event \${ev.event_name}\`);
  }
  if (condition == "path") {
    if (parameters == "*") {
      handleThirdPartyConfigScripts(ev);
    } else {
      const parsedUrl = url != null ? url : new URL(window.location.href);
      const path = url && url.pathname ? url.pathname : window.location.pathname;
      const queryParams = parsedUrl.searchParams;
      let queryParamCheck = true;
      try {
        if (ev.query_parameters) {
          if (ev.query_parameters.includes("&")) {
            let split = ev.query_parameters.split("&");
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
            const parsedValue = JSON.parse(ev.googleadsconversion);
            parsedValue.forEach(
              (val) => googleConversion(
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
function parseData(data = null, config, track_web_events, platformName) {
  const pageUrl = new URL(window.location.href);
  const debug = pageUrl.searchParams.has("lytxDebug");
  if (window.lytxDataLayer.length < 2) {
    console.log(\`Lytx script is working 🔥🔥🔥\${debug ? "🐛🐛🐛 debug enabled" : ""}\`);
  }
  function loadLytxEvents(url = new URL(window.location.href)) {
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
    track_web_events,
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
  };
  loadLytxEvents();
}`;
