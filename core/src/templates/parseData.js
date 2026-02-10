// Clean JavaScript version of parseData function for embedding
function parseData(data, config, trackCustomEvents, track_web_events, platformName) {
  const pageUrl = new URL(window.location.href);
  const debug = pageUrl.searchParams.has('lytxDebug'); 
  
  if(window.lytxDataLayer.length < 2) {
    console.log(`Lytx script is working 🔥🔥🔥${debug ? '🐛🐛🐛 debug enabled' : ''}`);
  }

  // Add the rest of your parseData logic here
  // Copy from the TypeScript version but as clean JavaScript
}