export function metaScript(config: { metaId?: string, eventName?: string, scriptInit?: boolean }) {
  const { metaId, eventName, scriptInit } = config;
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
    //@ts-expect-error
    !function(f, b, e, v, n, t, s) {
      //@ts-expect-error
      if (f.fbq) return; n = f.fbq = function() {
        //@ts-expect-error
        n.callMethod ?
          //@ts-expect-error
          n.callMethod.apply(n, arguments) : n.queue.push(arguments)
      };
      //@ts-expect-error
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
      //@ts-expect-error
      n.queue = []; t = b.createElement(e); t.async = !0;
      //@ts-expect-error
      t.src = v; s = b.getElementsByTagName(e)[0];
      //@ts-expect-error
      s.parentNode.insertBefore(t, s)
    }(window, document, 'script',
      'https://connect.facebook.net/en_US/fbevents.js');
  }
  if (window.fbq) {
    if (init) { window.fbq('init', `${id}`); }
    if (facebookPixelStandardEvents.includes(event)) {
      window.fbq('track', event);
    } else {
      window.fbq('trackCustom', event);
    }

  }
}
