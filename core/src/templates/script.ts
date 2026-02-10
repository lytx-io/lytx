export function simplfiScript(id: string) {
  return {
    async: true,
    src: `https://tag.simpli.fi/sifitag/${id}`,
    element: "script",
  };
}

export function quantcastScript(id: string) {
  return {
    async: true,
    src: "",
  };
}
export const pageScript = `
window._lytxEvents = window._lytxEvents || [];
(function () {
  const elem = document.createElement("script");
  elem.src = "http://localhost:8787/container.js?test=true";
  elem.async = true;
  elem.type = "text/javascript";
  const script = document.getElementsByTagName("script")[0];
  script.parentNode.insertBefore(elem, script);
}
)();
window._lytxEvents.push({
  lytxAccount: "lytx-main",
  labels: "lytx-main",
}
					   );
`;