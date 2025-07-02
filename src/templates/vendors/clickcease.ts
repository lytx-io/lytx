//TODO how to handle no js tag?
export function clickCeaseScript() {
  return {
    async: true,
    src: "https://www.clickcease.com/monitor/stat.js",
    type: "text/javascript",
  };
}
