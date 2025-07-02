// Standalone functions for embedding in client-side scripts
// This file will be compiled to clean JavaScript

// Copy the parseData function here without TypeScript types
function parseData(data, config, trackCustomEvents, track_web_events, platformName) {
  const pageUrl = new URL(window.location.href);
  const debug = pageUrl.searchParams.has('lytxDebug'); 
  
  if(window.lytxDataLayer.length < 2) {
    console.log(`Lytx script is working 🔥🔥🔥${debug ? '🐛🐛🐛 debug enabled' : ''}`);
  }

  function createScriptElement(src, async, type) {
    const script = document.createElement("script");
    script.src = src;
    script.async = async;
    let scriptPlacement = document.head.children[0];
    if(!scriptPlacement){
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
      callBack: function(id) {
        window._qevents = window._qevents || [];
        if(debug) {
          console.log('Quantcast label is : ', label);
        }
        const qStructure = {
          qacct: label
        };
        window._qevents.push(qStructure);
      }
    };
  }

  // Add the rest of your parseData logic here...
  // Copy from the TypeScript version but remove all type annotations
}

// Export for compilation
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parseData };
}