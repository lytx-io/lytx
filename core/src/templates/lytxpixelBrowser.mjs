// src/templates/lytxpixel.ts
var encodePixel = "R0lGODlhAQABAIAAANvf7wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";
var decodedPixel = atob(encodePixel);
//!BLINK X Product
//!Personalization type --> JSON
function parseData(data = null, config, trackCustomEvents, track_web_events, platformName) {
  const pageUrl = new URL(window.location.href);
  const debug = pageUrl.searchParams.has("lytxDebug");
  if (window.lytxDataLayer.length < 2) {
    console.log(`Lytx script is working \uD83D\uDD25\uD83D\uDD25\uD83D\uDD25${debug ? "\uD83D\uDC1B\uD83D\uDC1B\uD83D\uDC1B debug enabled" : ""}`);
  }
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
  function quantcastScript(label) {
    return {
      async: true,
      src: (document.location.protocol == "https:" ? "https://secure" : "http://edge") + ".quantserve.com/quant.js",
      element: "script",
      callBack: (id) => {
        window._qevents = window._qevents || [];
        if (debug) {
          console.log("Quantcast label is : ", label);
        }
        const qStructure = {
          qacct: id,
          labels: label ?? "_fp.event.PageView"
        };
        if (label) {
          qStructure.event = "refresh";
        }
        window._qevents.push(qStructure);
      }
    };
  }
  function simplfiScript(id) {
    return {
      async: true,
      src: `https://tag.simpli.fi/sifitag/${id}`,
      element: "script"
    };
  }
  function decodeHtmlEntities(str) {
    return str.replaceAll(/&#39;/g, "'").replaceAll(/&quot;/g, '"').replaceAll(/&gt;/g, ">").replaceAll(/&lt;/g, "<").replaceAll(/&amp;/g, "&");
  }
  function customScript(script) {
    if (debug) {
      console.log("Custom script is : ", script);
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
  function googleTagScript(id) {
    return {
      async: true,
      src: `https://www.googletagmanager.com/gtag/js?id=${id}`,
      id,
      callBack: (id2) => {
        window.dataLayer = window.dataLayer || [];
        if (window.gtag_lytx) {
          const gtag_lytx = function() {
            window.dataLayer.push(arguments);
          };
          gtag_lytx("config", new Date);
          gtag_lytx("config", id2);
        } else {
          const gtagScript = document.createElement("script");
          gtagScript.innerHTML = `
          window.dataLayer = window.dataLayer || [];
          function gtag_lytx(){window.dataLayer.push(arguments);}
          gtag_lytx('js', new Date());

          gtag_lytx('config', '${id2}');
          `;
          const scriptTags = document.head.querySelectorAll("script");
          let scriptPlacement = document.head.children[0];
          if (scriptTags) {
            const scripts = [...scriptTags];
            const activeGscript = scripts.filter((val) => val.src.includes(`id=${id2}`));
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
  function metaScript(config2) {
    const { metaId, eventName, scriptInit } = config2;
    let init = scriptInit ?? false;
    let event = eventName ?? "PageView";
    let id = metaId ?? "";
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
      (function(f, b, e, v, n, t, s) {
        if (f.fbq)
          return;
        n = f.fbq = function() {
          n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
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
      })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    }
    if (window.fbq) {
      if (init) {
        window.fbq("init", `${id}`);
      }
      if (facebookPixelStandardEvents.includes(event)) {
        window.fbq("track", event);
      } else {
        window.fbq("trackCustom", event);
      }
    }
  }
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
  function handleIframe(config2) {
    window.addEventListener("blur", function() {
      window.setTimeout(function() {
        if (config2.element && document.activeElement instanceof HTMLIFrameElement) {
          if (config2.debug) {
            console.log("Debug Iframe element is : ", config2.element, document.activeElement);
          }
          if (config2.callback && document.activeElement == config2.element) {
            if (config2.debug)
              console.log(config2.element, `Iframe Has been tracked correctly event name is ${config2.name ?? ""}`);
            if (config2.callback.arguments) {
              config2.callback.func(...config2.callback.arguments);
            } else {
              config2.callback.func();
            }
          }
        }
      }, 0);
    });
  }
  function googleConversion(GoogleCommand, id, type, value) {
    const options = {};
    if (GoogleCommand == "config") {
      options[`${type}`] = value;
      try {
        if (window.gtag_lytx) {
          window.gtag_lytx(GoogleCommand, id, options);
        } else {
          const gtagScript = document.createElement("script");
          gtagScript.innerHTML = `
          gtag_lytx('${GoogleCommand}', '${id}', {
          '${type}': '${value}'
          });
          `;
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
      if (type == "conversion") {
        try {
          const gtag_report_conversion = (url = undefined) => {
            const callback = function() {
              if (typeof url != "undefined") {
                window.location = url;
              }
            };
            window.gtag_lytx(GoogleCommand, type, {
              send_to: id,
              value,
              event_callback: callback
            });
            return false;
          };
          gtag_report_conversion();
        } catch (error) {
          console.log(error);
        }
      }
    }
  }
  function clickCeaseScript() {
    return {
      async: true,
      src: "https://www.clickcease.com/monitor/stat.js",
      type: "text/javascript"
    };
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
    if (window.lytxDataLayer && window.lytxDataLayer.length > 1) {
      window.lytxDataLayer.find((layer) => layer.tag == config.tag)?.tracked.push(trackedEvent);
    } else {
      window.lytxDataLayer[0].tracked.push(trackedEvent);
    }
  }
  function trackDataPassBack() {}
  function trackCustomRecord(event) {
    if (track_web_events) {
      trackCustomEvents(config.tag, platformName, { custom: event.event_name });
      if (debug) {
        console.log("Event tracked is", event.event_name);
      }
    }
  }
  function googleClickConversion(elems, parsedValue) {
    elems.forEach((elem) => {
      elem.addEventListener("click", () => {
        parsedValue.forEach((val) => googleConversion(val.GoogleCommand, val.id, val.type, val.value));
      });
    });
  }
  function googleSingleClickConversion(elem, parsedValue) {
    elem.addEventListener("click", () => {
      parsedValue.forEach((val) => googleConversion(val.GoogleCommand, val.id, val.type, val.value));
    });
  }
  function loadLytxEvents(url = new URL(window.location.href)) {
    if (data) {
      if (window.lytxDataLayer.length < 2) {
        console.log("⚡⚡⚡⚡ See Defined Lytx Events Here ⚡⚡⚡⚡ -->", window.lytxDataLayer);
      }
      try {
        data.forEach((ev) => {
          //!TODO add missing events
          if (ev.condition == "path") {
            if (ev.parameters == "*") {
              if (ev.metaEvent) {
                metaScript({ metaId: ev.metaEvent, scriptInit: true });
              }
              if (ev.linkedinEvent) {
                linkedinScript(ev.linkedinEvent);
              }
              if (ev.SimplfiPixelid) {
                const newScript = simplfiScript(ev.SimplfiPixelid);
                createScriptElement(newScript.src, newScript.async);
              }
              if (ev.googleanalytics) {
                const newScript = googleTagScript(ev.googleanalytics);
                createScriptElement(newScript.src, true);
                newScript.callBack(newScript.id);
              }
              if (ev.QuantcastPixelId) {
                const newScript = quantcastScript();
                createScriptElement(newScript.src, true);
                newScript.callBack(ev.QuantcastPixelId);
              }
              if (ev.clickCease && ev.clickCease == "enabled") {
                const newScript = clickCeaseScript();
                createScriptElement(newScript.src, newScript.async, newScript.type);
              }
              if (ev.googleadsscript) {
                const newScript = googleTagScript(ev.googleadsscript);
                createScriptElement(newScript.src, true);
                newScript.callBack(newScript.id);
              }
              if (ev.customScript) {
                customScript(ev.customScript);
              }
              if (ev.googleadsconversion) {
                try {
                  const parsedValue = JSON.parse(ev.googleadsconversion);
                  parsedValue.forEach((val) => googleConversion(val.GoogleCommand, val.id, val.type, val.value));
                } catch (error) {
                  console.log(error);
                }
              }
            } else {
              const parsedUrl = url ?? new URL(window.location.href);
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
                    parsedValue.forEach((val) => googleConversion(val.GoogleCommand, val.id, val.type, val.value));
                  } catch (error) {
                    console.log(error);
                  }
                }
              }
            }
          } else if (ev.condition == "dom element") {
            if (ev.rules == "click") {
              try {
                let elem = document.querySelector(`[${ev.parameters}]`);
                let queryAll = false;
                const delay = { enabled: false, amount: 0 };
                let iframe = false;
                let allElems = null;
                if (ev.paramConfig) {
                  if (debug)
                    console.log(`This is the param config for${ev.event_name}`, ev.paramConfig);
                  let parseConfig;
                  if (ev.paramConfig.includes("&quot;")) {
                    let rawStr = ev.paramConfig.replaceAll("&quot;", '"');
                    if (debug)
                      console.log(rawStr, JSON.parse(rawStr));
                    parseConfig = JSON.parse(rawStr);
                  } else {
                    parseConfig = JSON.parse(ev.paramConfig);
                  }
                  if (parseConfig) {
                    if (parseConfig.delay) {
                      delay.amount = Number(parseConfig.delay);
                      delay.enabled = true;
                      if (debug)
                        console.log(`Delay of ${delay.amount} has been enabled for : ${ev.event_name}`);
                    }
                    if (parseConfig.iframe) {
                      iframe = true;
                    }
                  }
                  if (debug)
                    console.log(parseConfig);
                  if (parseConfig && parseConfig.querySelectorAll) {
                    if (parseConfig.path) {
                      const path = window.location.pathname;
                      if (path.includes(`${parseConfig.path}`) || parseConfig.path == "*") {
                        if (parseConfig.querySelectorAll == "all") {
                          queryAll = true;
                          allElems = document.querySelectorAll(`[${ev.parameters}]`);
                          if (debug) {
                            console.log(`\uD83D\uDC1B\uD83D\uDC1B\uD83D\uDC1B ${ev.event_name} has the following elements tracked`, allElems);
                          }
                        } else {
                          elem = document.querySelectorAll(`[${ev.parameters}]`)[parseConfig.querySelectorAll];
                        }
                      }
                    } else {
                      if (parseConfig.querySelectorAll == "all") {
                        queryAll = true;
                        allElems = document.querySelectorAll(`[${ev.parameters}]`);
                      } else {
                        elem = document.querySelectorAll(`[${ev.parameters}]`)[parseConfig.querySelectorAll];
                      }
                    }
                    if (!elem)
                      elem = document.querySelector(`[${ev.parameters}]`);
                  }
                }
                let clicked = false;
                if (elem) {
                  if (track_web_events) {
                    if (queryAll && allElems) {
                      allElems.forEach((el) => {
                        el.addEventListener("click", () => {
                          trackCustomRecord(ev);
                        });
                      });
                    } else {
                      if (delay.enabled) {
                        setTimeout(() => {
                          const delayElem = document.querySelector(`[${ev.parameters}]`);
                          delayElem.addEventListener("click", () => {
                            trackCustomRecord(ev);
                          });
                          if (debug) {
                            console.log(`Delayed track record event added for event : ${ev.event_name} and element -->`, delayElem);
                          }
                        }, delay.amount);
                      } else {
                        elem.addEventListener("click", () => {
                          trackCustomRecord(ev);
                        });
                      }
                    }
                  }
                  if (ev.SimplfiPixelid) {
                    if (queryAll && allElems) {
                      allElems.forEach((el) => {
                        el.addEventListener("click", () => {
                          if (ev.SimplfiPixelid) {
                            const newScript = simplfiScript(ev.SimplfiPixelid);
                            createScriptElement(newScript.src, newScript.async);
                            updateEventRecord(ev);
                          }
                        });
                      });
                    } else {
                      elem.addEventListener("click", () => {
                        if (!clicked && ev.SimplfiPixelid) {
                          const newScript = simplfiScript(ev.SimplfiPixelid);
                          createScriptElement(newScript.src, newScript.async);
                          updateEventRecord(ev);
                          clicked = true;
                        }
                      });
                    }
                  }
                  if (ev.googleadsconversion) {
                    try {
                      const parsedValue = JSON.parse(ev.googleadsconversion);
                      if (queryAll) {
                        if (delay.enabled) {
                          setTimeout(() => {
                            if (allElems) {
                              googleClickConversion(allElems, parsedValue);
                              if (debug) {
                                console.log("Delayed event added", ev.event_name);
                              }
                            }
                          }, delay.amount);
                        } else {
                          if (allElems) {
                            googleClickConversion(allElems, parsedValue);
                          }
                        }
                      } else {
                        if (delay.enabled) {
                          setTimeout(() => {
                            const delayElem = document.querySelector(`[${ev.parameters}]`);
                            googleSingleClickConversion(delayElem, parsedValue);
                            if (debug) {
                              console.log(`Delayed event added for event : ${ev.event_name} and element -->`, delayElem);
                            }
                          }, delay.amount);
                        } else {
                          googleSingleClickConversion(elem, parsedValue);
                          //!Iframe
                          try {
                            if (iframe) {
                              handleIframe({
                                name: ev.event_name,
                                callback: {
                                  func: googleSingleClickConversion,
                                  arguments: [elem, parsedValue]
                                },
                                element: elem,
                                debug
                              });
                            }
                          } catch (error) {
                            console.error("Iframe handler mishandled", error);
                          }
                        }
                      }
                    } catch (error) {
                      console.log(error);
                    }
                  }
                  if (ev.QuantcastPixelId) {
                    elem.addEventListener("click", () => {
                      updateEventRecord(ev);
                      if (ev.QuantcastPixelId && ev.QuantCastPixelLabel) {
                        const newQEvent = quantcastScript(ev.QuantCastPixelLabel);
                        newQEvent.callBack(ev.QuantcastPixelId);
                      }
                    });
                  }
                  if (ev.metaEvent) {
                    elem.addEventListener("click", () => {
                      updateEventRecord(ev);
                      metaScript({ metaId: ev.metaEvent, eventName: ev.event_name });
                    });
                  }
                }
              } catch (error) {
                console.log(error);
              }
            } else if (ev.rules == "submit") {
              try {
                const elem = document.querySelector(`[${ev.parameters}]`);
                let submitted = false;
                if (elem) {
                  if (track_web_events) {
                    elem.addEventListener("submit", () => {
                      trackCustomRecord(ev);
                    });
                  }
                  if (ev.SimplfiPixelid) {
                    elem.addEventListener("submit", () => {
                      if (!submitted && ev.SimplfiPixelid) {
                        const newScript = simplfiScript(ev.SimplfiPixelid);
                        createScriptElement(newScript.src, newScript.async);
                        updateEventRecord(ev);
                        submitted = true;
                      }
                    });
                  }
                  if (ev.metaEvent) {
                    elem.addEventListener("submit", () => {
                      updateEventRecord(ev);
                      metaScript({ metaId: ev.metaEvent, eventName: ev.event_name });
                    });
                  }
                }
              } catch (error) {}
            }
          }
        });
      } catch (error) {
        console.log(error);
      }
    }
  }
  window.lytxApi = {
    emit: loadLytxEvents,
    event: () => {},
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
}
export {
  parseData,
  decodedPixel
};
