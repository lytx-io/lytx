// Clean JavaScript functions for embedding (no TypeScript artifacts)

function parseData(data, config, trackCustomEvents, track_web_events, platformName) {
  const pageUrl = new URL(window.location.href);
  const debug = pageUrl.searchParams.has('lytxDebug'); 
  
  if(window.lytxDataLayer.length < 2) {
    console.log('Lytx script is working 🔥🔥🔥' + (debug ? '🐛🐛🐛 debug enabled' : ''));
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

  function gtag_report_conversion(url) {
    const callback = function() {
      if (typeof url != "undefined") {
        window.location = url;
      }
    };
    gtag('event', 'conversion', {
      'send_to': 'AW-123456789/AbC-D_efG-h12_34-567',
      'event_callback': callback
    });
    return false;
  }

  // Add your other function logic here...
}

function trackEvents(account, platformName, event, macros) {
  // Add trackEvents logic here
  console.log('trackEvents called with:', account, platformName, event);
}