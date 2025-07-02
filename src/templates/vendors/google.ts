export type GoogleEvent = "phone_conversion_number" | "conversion";
export type GoogleCommand = "config" | "event" | "set" | "get" | "consent";

export type GoogleConversionParams = {
  GoogleCommand: GoogleCommand;
  id: string;
  type: GoogleEvent;
  value?: string;
}

export type googleParam = "config"
export type googleParamSlot2 = Date | string;


export type gtag = (param: googleParam, param2: googleParamSlot2) => void;


export function googleTagScript(id: string) {
  return {
    async: true,
    src: `https://www.googletagmanager.com/gtag/js?id=${id}`,
    id: id,
    callBack: (id: string) => {
      window.dataLayer = window.dataLayer || [];
      if (window.gtag_lytx) {
        const gtag_lytx: gtag = function() {
          window.dataLayer.push(arguments);
        }
        window.gtag_lytx = gtag_lytx;
        gtag_lytx("config", new Date());
        gtag_lytx("config", id);
      } else {
        const gtagScript = document.createElement('script');

        gtagScript.innerHTML = `
          window.dataLayer = window.dataLayer || [];
          function gtag_lytx(){window.dataLayer.push(arguments);}
          gtag_lytx('js', new Date());

          gtag_lytx('config', '${id}');
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


export function manualGoogleConversion(send_to: string, options?: Record<string, any>) {
  function gtag_report_conversion(url: any) {
    var callback = function() {
      if (typeof (url) != 'undefined') {
        window.location = url;
      }
    };
    window.gtag_lytx('event', 'conversion', {
      'send_to': send_to,
      'event_callback': callback,
      ...options,
    });
    return false;
  }
  //@ts-ignore
  gtag_report_conversion();
}


export function googleConversion(
  GoogleCommand: GoogleCommand,
  id: string,
  type: GoogleEvent,
  value?: string | number
) {
  //@ts-ignore
  const options: Record<GoogleEvent, any> = {};

  if (GoogleCommand == "config") {
    if (window.lytxApi.debugMode) { console.log("Google Event is : ", type, GoogleCommand, id, value) }

    //?Add groups for GA4 configs
    options[`${type}`] = value;
    try {
      if (window.gtag_lytx) {
        window.gtag_lytx(GoogleCommand, id, options);
      } else {
        const gtagScript = document.createElement('script');
        gtagScript.innerHTML = `
          gtag_lytx('${GoogleCommand}', '${id}', {
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
  else if (GoogleCommand == "event") {
    if (window.lytxApi.debugMode) { console.log("Google Event is : ", type, GoogleCommand, id, value) }
    if (type == "conversion") {
      manualGoogleConversion(id, { value: value });
    }
  }


}


function googleClickConversion(elems: NodeListOf<HTMLElement>, parsedValue: {
  GoogleCommand: GoogleCommand;
  id: string;
  type: GoogleEvent;
  value?: string | undefined;
}[]) {
  elems.forEach((elem) => {
    elem.addEventListener("click", () => {

      parsedValue.forEach((val) =>
        googleConversion(
          val.GoogleCommand,
          val.id,
          val.type,
          val.value
        )
      );
    });
  })
}

function googleSingleClickConversion(elem: Element, parsedValue: {
  GoogleCommand: GoogleCommand;
  id: string;
  type: GoogleEvent;
  value?: string | undefined;
}[]) {

  elem.addEventListener("click", () => {

    parsedValue.forEach((val) =>
      googleConversion(
        val.GoogleCommand,
        val.id,
        val.type,
        val.value
      )
    );
  });

}
