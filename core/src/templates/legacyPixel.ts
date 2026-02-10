import type {
  fireMode,
  googleConversionType,
  googleParam,
  googleParamSlot2,
  gtag,
  PageEvent,
  LytxEvent,
  paramConfig

} from "./lytxpixel";

//wait till page loads
export function lytxScript(pixelUrl = "https://lytx.io/activity") {
  //{labels? : string, account : string, referrer : string, data_passback:string,data_event:string,message:string,screen_width:string,screen_height:string}  
  async function trackData() {
    const req = await fetch("/datapassback", {
      method: "POST",
      headers: {
        'Content-Type': "application/json"
      },
      body: JSON.stringify({
        labels: "test",
        account: "test",
        referrer: document.referrer ?? null,
        data_passback: "data",
        data_event: "event name",
        message: "message here",
        screen_width: window.innerWidth,
        screen_height: window.innerHeight
      })
    })
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
  function quantcastScript() {
    return {
      async: true,
      src: (document.location.protocol == "https:" ? "https://secure" : "http://edge") + ".quantserve.com/quant.js",
      element: "script",
      callBack: (id: string) => {
        window._qevents = window._qevents || [];
        window._qevents.push({
          "qacct": id,
          "labels": "_fp.event.PageView"
        });
      }
    }
  }
  function simplfiScript(id: string) {
    return {
      async: true,
      src: `https://tag.simpli.fi/sifitag/${id}`,
      element: "script",
    };
  }
  function customScript(script: string) {
    //eval?

    try {
      const createCustomScript = document.createElement('script');

      createCustomScript.innerHTML = script;

      const scriptPlacement = document.getElementsByTagName("script")[0];

      scriptPlacement.parentNode!.insertBefore(createCustomScript, scriptPlacement);
    } catch (error) {
      console.error(error);
    }

  }
  function googleTagScript(id: string) {
    return {
      async: true,
      src: `https://www.googletagmanager.com/gtag/js?id=${id}`,
      id: id,
      callBack: (id: string) => {
        window.dataLayer = window.dataLayer || [];
        if (window.gtag) {
          const gtag: gtag = () => {
            //@ts-ignore
            window.dataLayer.push(arguments);
          }
          gtag("config", new Date());
          gtag("config", id);
        } else {
          const gtagScript = document.createElement('script');

          gtagScript.innerHTML = `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());

          gtag('config', '${id}');
          `;

          const scriptTags = document.head.querySelectorAll('script');
          let scriptPlacement = document.head.children[0];
          if (scriptTags) {
            const scripts = [...scriptTags as any] as HTMLScriptElement[];

            const activeGscript = scripts.filter((val) => val.src.includes(`id=${id}`));

            try {
              scriptPlacement = activeGscript[0].nextSibling as Element;
            } catch (error) {
              console.log(error);
            }

          }

          if (!scriptPlacement) {
            scriptPlacement = document.getElementsByTagName("script")[0];
          }
          scriptPlacement.parentNode!.insertBefore(gtagScript, scriptPlacement);

        }
      },
    };
  }

  function googleConversion(
    fireMode: fireMode,
    id: string,
    type: googleConversionType,
    value?: string | number
  ) {
    //@ts-ignore
    const options: Record<googleConversionType, any> = {};

    if (fireMode == "config") {
      options[`${type}`] = value;
      try {
        if (window.gtag) {
          window.gtag(fireMode, id, options);
        } else {
          const gtagScript = document.createElement('script');
          gtagScript.innerHTML = `
          gtag('${fireMode}', '${id}', {
          '${type}': '${value}'
          });
          `;
          let scriptPlacement = document.head.children[0];
          if (!scriptPlacement) {
            scriptPlacement = document.getElementsByTagName("script")[0];
          }
          scriptPlacement.parentNode!.insertBefore(gtagScript, scriptPlacement);
        }

      } catch (error) {
        console.log(error);
      }
    }
    else if (fireMode == "event") {
      //inspect 
      if (type == "conversion") {
        try {
          const gtag_report_conversion = (url: Location | undefined = undefined) => {
            const callback = function() {
              if (typeof url != "undefined") {
                window.location = url;
              }
            };

            window.gtag(fireMode, type, {
              send_to: id,
              value: value,
              event_callback: callback,
            });
            return false;
          }
          gtag_report_conversion();
        } catch (error) {
          console.log(error);
        }
      }
    }


  }
  //TODO how to handle no js tag?
  function clickCeaseScript() {
    return {
      async: true,
      src: "https://www.clickcease.com/monitor/stat.js",
      type: "text/javascript",
    };
  }

  function splitQueryParams(split: string[] | string, queryParams: URLSearchParams, skipSmallSplit = false) {
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

  async function setCustomEvents(lytxEvents: LytxEvent[] | PageEvent[]) {
    const lytxRequest = await window.fetch(pixelUrl, {
      method: "POST",

      body: JSON.stringify({
        lytx: lytxEvents[0],
        url: window.location.href,
      }),
    });

    const lytxResponse = (await lytxRequest.json()) as {
      status: string;
      events: PageEvent[] | null;
    };

    if (lytxResponse.events) {
      lytxResponse.events.forEach((ev) => {
        //@ts-ignore
        if (!lytxEvents.find((val) => val.parameters == ev.parameters)) {
          if (ev.condition == "path") {
            if (ev.parameters == "*") {
              if (ev.SimplfiPixelid) {
                //load script
                const newScript = simplfiScript(ev.SimplfiPixelid);
                createScriptElement(newScript.src, newScript.async);
                window._lytxEvents.push(ev);
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
                createScriptElement(
                  newScript.src,
                  newScript.async,
                  newScript.type
                );
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
                  //fireMode :fireMode,id:string,type:googleConversionType,value?:string
                  const parsedValue = JSON.parse(ev.googleadsconversion) as {
                    fireMode: fireMode;
                    id: string;
                    type: googleConversionType;
                    value?: string;
                  }[];

                  parsedValue.forEach((val) =>
                    googleConversion(val.fireMode, val.id, val.type, val.value)
                  );
                } catch (error) {
                  console.log(error);
                }
              }
            } else {

              const parsedUrl = new URL(window.location.href);
              const path = window.location.pathname;
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

                  window._lytxEvents.push(ev);
                }
                if (ev.googleadsconversion) {
                  try {
                    //fireMode :fireMode,id:string,type:googleConversionType,value?:string
                    const parsedValue = JSON.parse(ev.googleadsconversion) as {
                      fireMode: fireMode;
                      id: string;
                      type: googleConversionType;
                      value?: string;
                    }[];

                    parsedValue.forEach((val) =>
                      googleConversion(
                        val.fireMode,
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
          } else if (ev.condition == "dom element") {
            if (ev.rules == "click") {
              try {
                //check type

                let elem = document.querySelector(`[${ev.parameters}]`);
                let queryAll = false;
                let allElems = null;
                if (ev.paramConfig) {
                  const parseConfig = JSON.parse(ev.paramConfig) as paramConfig;
                  if (parseConfig && parseConfig.querySelectorAll) {
                    //TODO convert type to interface?

                    if (parseConfig.path) {
                      const path = window.location.pathname;
                      if (path.includes(`${parseConfig.path}`)) {
                        if (parseConfig.querySelectorAll == 'all') {
                          queryAll = true;
                          allElems = document.querySelectorAll(`[${ev.parameters}]`);
                        } else {
                          //@ts-ignore
                          elem = document.querySelectorAll(`[${ev.parameters}]`)[parseConfig.querySelectorAll];
                        }

                      }
                    } else {
                      if (parseConfig.querySelectorAll == 'all') {
                        queryAll = true;
                        allElems = document.querySelectorAll(`[${ev.parameters}]`);
                      } else {
                        //@ts-ignore
                        elem = document.querySelectorAll(`[${ev.parameters}]`)[parseConfig.querySelectorAll];
                      }
                    }


                    if (!elem) elem = document.querySelector(`[${ev.parameters}]`);
                  }
                }

                let clicked = false;
                if (elem) {
                  if (ev.SimplfiPixelid) {
                    elem.addEventListener("click", () => {
                      if (!clicked && ev.SimplfiPixelid) {
                        const newScript = simplfiScript(ev.SimplfiPixelid);
                        createScriptElement(newScript.src, newScript.async);
                        window._lytxEvents.push(ev);
                        clicked = true;
                      }
                    });
                  }
                  if (ev.googleadsconversion) {
                    try {
                      //fireMode :fireMode,id:string,type:googleConversionType,value?:string
                      const parsedValue = JSON.parse(
                        ev.googleadsconversion
                      ) as {
                        fireMode: fireMode;
                        id: string;
                        type: googleConversionType;
                        value?: string;
                      }[];
                      if (queryAll) {
                        if (allElems) {
                          allElems.forEach((elem) => {
                            elem.addEventListener("click", () => {

                              parsedValue.forEach((val) =>
                                googleConversion(
                                  val.fireMode,
                                  val.id,
                                  val.type,
                                  val.value
                                )
                              );
                            });
                          })
                        }
                      } else {
                        elem.addEventListener("click", () => {

                          parsedValue.forEach((val) =>
                            googleConversion(
                              val.fireMode,
                              val.id,
                              val.type,
                              val.value
                            )
                          );
                        });
                      }

                    } catch (error) {
                      console.log(error);
                    }
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
                  if (ev.SimplfiPixelid) {
                    elem.addEventListener("submit", () => {
                      if (!submitted && ev.SimplfiPixelid) {
                        const newScript = simplfiScript(ev.SimplfiPixelid);
                        createScriptElement(newScript.src, newScript.async);
                        window._lytxEvents.push(ev);
                        submitted = true;
                      }
                    });
                  }
                }
              } catch (error) { }
            }
          }
        }
      });
    }
  }

  try {
    console.log("Lytx script is working 🔥🔥🔥");

    if (window._lytxEvents) {
      const lytxEvents = window._lytxEvents;

      onload = async () => {
        console.log(
          "⚡⚡⚡⚡ See Defined Lytx Events Here ⚡⚡⚡⚡ -->",
          //@ts-ignore
          lytxEvents
        );


        await setCustomEvents(lytxEvents);

        window.onpopstate = async (event) => {
          await setCustomEvents(lytxEvents);
          console.log(
            "⚡⚡⚡⚡ See Defined Lytx Events Here ⚡⚡⚡⚡ -->",
            //@ts-ignore
            lytxEvents
          );
        };
      };
    }
  } catch (error) {
    console.log(error);
  }
}
