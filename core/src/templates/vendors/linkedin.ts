export function linkedinScript(id: string) {

  const _linkedin_partner_id = id;
  window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
  window._linkedin_data_partner_ids.push(_linkedin_partner_id);

  (function(l) {
    if (!l) {
      //@ts-expect-error
      window.lintrk = function(a, b) { window.lintrk.q.push([a, b]) };
      //@ts-expect-error
      window.lintrk.q = []
    }
    var s = document.getElementsByTagName("script")[0];
    var b = document.createElement("script");
    b.type = "text/javascript"; b.async = true;
    b.src = "https://snap.licdn.com/li.lms-analytics/insight.min.js";
    //@ts-expect-error
    s.parentNode.insertBefore(b, s);
  })(window.lintrk);


}
