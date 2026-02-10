export function quantcastScript(label?: string) {
  return {
    async: true,
    src: (document.location.protocol == "https:" ? "https://secure" : "http://edge") + ".quantserve.com/quant.js",
    element: "script",
    callBack: (id: string) => {
      window._qevents = window._qevents || [];
      if (window.lytxApi.debugMode) {
        console.log('Quantcast label is : ', label);
      }
      const qStructure = {
        "qacct": id,
        "labels": label ?? "_fp.event.PageView"
      }
      if (label) {
        //@ts-expect-error
        qStructure.event = "refresh";
      }
      window._qevents.push(qStructure);
    }
  }
}
