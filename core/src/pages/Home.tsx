import { MarketingLayout } from "@/app/components/marketing/MarketingLayout";
import { SectionHeading } from "@/app/components/marketing/SectionHeading";
import { CheckIcon } from "@/app/components/marketing/CheckIcon";

export function Home() {
  return (
    <MarketingLayout navLinks={[{ label: "Features", href: "#features" }, { label: "Pricing", href: "/pricing" }, { label: "FAQ", href: "#faq" }]}>

        {/* Hero Section */}
        <section className="relative pt-28 sm:pt-32 pb-12 sm:pb-20 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
            <div className="mx-auto max-w-4xl">
              <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-slate-900 dark:text-white mb-8 leading-[1.1]">
                Analytics for <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
                  builders & creators
                </span>
              </h1>
              <p className="mt-4 text-xl text-slate-600 dark:text-slate-400 mb-8 max-w-[46rem] mx-auto leading-relaxed">
                Open-source, privacy-first web analytics. All the insights you need, none of the tracking you don't.
              </p>

              {/* Pills */}
              <div className="flex flex-wrap justify-center gap-2 mb-10">
                {["Privacy-first", "Cookie-less", "Open Source", "Self-hostable", "Lightweight"].map((badge) => (
                  <span key={badge} className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium border border-slate-200 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400">
                    {badge}
                  </span>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row justify-center gap-4 mb-4">
                <a
                  href="/signup"
                  className="inline-flex items-center justify-center px-8 py-3.5 text-base font-semibold rounded-full text-white bg-brand-cta hover:bg-brand-cta-hover transition-all"
                >
                  Get Started
                </a>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-16">
                Cloud from $19/mo · Self-host free
              </p>
            </div>

            {/* Hero Image */}
            <div className="relative mx-auto max-w-5xl">
              <div className="rounded-xl bg-slate-900/5 p-2 ring-1 ring-inset ring-slate-900/10 lg:rounded-2xl lg:p-3 dark:bg-white/5 dark:ring-white/10 backdrop-blur-sm">
                <img
                  src="/images/lytx_light_dashboard.png"
                  alt="Lytx Dashboard"
                  className="w-full rounded-lg shadow-2xl ring-1 ring-slate-900/10 dark:ring-black/20 block dark:hidden"
                />
                <img
                  src="/images/lytx_dark_dashboard.png"
                  alt="Lytx Dashboard"
                  className="w-full rounded-lg shadow-2xl ring-1 ring-slate-900/10 dark:ring-black/20 hidden dark:block"
                />
              </div>
              {/* Glow effects */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full -z-10 bg-amber-500/20 blur-[100px] rounded-full opacity-50 pointer-events-none"></div>
            </div>
          </div>
        </section>

        {/* Features - Alternating Layout */}
        <section id="features" className="py-16 sm:py-24 space-y-32 scroll-mt-20">
          {/* Feature 1 */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col lg:flex-row items-center gap-16">
              <div className="flex-1 min-w-0 w-full order-2 lg:order-1">
                <div className="rounded-xl bg-slate-100 p-5 sm:p-8 border border-slate-200 dark:bg-slate-900 dark:border-slate-800 shadow-xl">
                  {/* Abstract representation of analytics */}
                  <div className="space-y-4">
                    <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-800 rounded"></div>
                    <div className="h-32 w-full bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-100 dark:border-amber-900/50 flex items-end p-4 gap-2">
                      <div className="w-full bg-amber-400/20 rounded-t h-[40%]"></div>
                      <div className="w-full bg-amber-400/40 rounded-t h-[70%]"></div>
                      <div className="w-full bg-amber-400/60 rounded-t h-[50%]"></div>
                      <div className="w-full bg-amber-400/80 rounded-t h-[90%]"></div>
                      <div className="w-full bg-amber-500 rounded-t h-[60%]"></div>
                    </div>
                    <div className="flex gap-4">
                      <div className="h-20 w-1/2 bg-slate-200 dark:bg-slate-800 rounded"></div>
                      <div className="h-20 w-1/2 bg-slate-200 dark:bg-slate-800 rounded"></div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex-1 min-w-0 w-full order-1 lg:order-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold uppercase tracking-wider mb-6 border border-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  Web Analytics
                </div>
                <h3 className="text-3xl font-bold text-slate-900 dark:text-white mb-6">
                  All your metrics in one place
                </h3>
                <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed mb-8">
                  Get a comprehensive view of your website's performance. Track visitors, page views, bounce rates, and more without getting lost in complicated menus.
                </p>
                <ul className="space-y-4">
                  {[
                    "Real-time visitor counts",
                    "Top pages and referrers",
                    "Device and location data",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-slate-600 dark:text-slate-400">
                      <CheckIcon className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Feature 2 */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col lg:flex-row items-center gap-16">
              <div className="flex-1 min-w-0 w-full">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 text-orange-700 text-xs font-semibold uppercase tracking-wider mb-6 border border-orange-100 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800">
                  <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                  Product Analytics
                </div>
                <h3 className="text-3xl font-bold text-slate-900 dark:text-white mb-6">
                  Understand user journeys
                </h3>
                <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed mb-8">
                  See exactly how users interact with your product. Identify drop-off points, optimize conversion funnels, and make data-driven decisions.
                </p>
                <ul className="space-y-4">
                  {[
                    "Custom event tracking",
                    "Funnel analysis",
                    "Retention cohorts",
                    "User flow visualization"
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-slate-600 dark:text-slate-400">
                      <CheckIcon className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex-1 min-w-0 w-full">
                <div className="rounded-xl bg-slate-100 p-5 sm:p-8 border border-slate-200 dark:bg-slate-900 dark:border-slate-800 shadow-xl">
                  {/* Abstract representation of funnels */}
                  <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
                      <div className="w-full sm:flex-1 min-w-0 bg-orange-500 h-12 rounded opacity-100 flex items-center justify-center text-white font-bold text-sm">100%</div>
                      <div className="self-center w-1 h-5 sm:w-16 sm:h-1 bg-slate-300 dark:bg-slate-700"></div>
                      <div className="w-full sm:flex-1 min-w-0 bg-orange-500 h-12 rounded opacity-75 flex items-center justify-center text-white font-bold text-sm">75%</div>
                      <div className="self-center w-1 h-5 sm:w-16 sm:h-1 bg-slate-300 dark:bg-slate-700"></div>
                      <div className="w-full sm:flex-1 min-w-0 bg-orange-500 h-12 rounded opacity-50 flex items-center justify-center text-white font-bold text-sm">40%</div>
                    </div>
                    <div className="h-32 w-full bg-slate-200 dark:bg-slate-800 rounded-lg"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Trust Grid */}
        <section className="py-24 bg-slate-50 dark:bg-slate-900/30 border-y border-slate-200 dark:border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <SectionHeading title="Privacy is our business" align="left" />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { title: "Privacy First", desc: "No IP tracking, no fingerprinting, no cookies. Compliant with GDPR, CCPA, and PECR." },
                { title: "Data Ownership", desc: "You own your data. Export it anytime. We never sell or share your data with third parties." },
                { title: "Open Source", desc: "Our code is public. You can audit exactly what we do and how we handle your data." },
                { title: "Lightweight", desc: "Our script is under 5kb. It loads asynchronously and never slows down your website." }
              ].map((card, i) => (
                <div key={i} className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <h3 className="font-bold text-slate-900 dark:text-white mb-2">{card.title}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{card.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Integration */}
        <section className="py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-slate-900 rounded-3xl p-8 md:p-16 text-center md:text-left relative overflow-hidden">
              {/* Background decoration */}
              <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-amber-500/20 blur-3xl rounded-full"></div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center relative z-10">
                <div>
                  <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                    Install in seconds
                  </h2>
                  <p className="text-lg text-slate-400 mb-8">
                    Just add our lightweight snippet to your website's <code className="bg-white/10 px-1.5 py-0.5 rounded text-white font-mono text-sm">&lt;head&gt;</code> and you're good to go. It works with any framework.
                  </p>
                  <div className="flex flex-wrap gap-4">
                    {/* Framework Logos (Text for now) */}
                    {["React", "Vue", "Next.js", "WordPress", "Shopify"].map(fw => (
                      <span key={fw} className="px-3 py-1 rounded-md bg-white/10 text-white/80 text-sm">{fw}</span>
                    ))}
                  </div>
                </div>
                <div className="bg-black/50 rounded-xl p-6 border border-white/10 font-mono text-sm text-left shadow-2xl overflow-x-auto">
                  <div className="flex gap-1.5 mb-4">
                    <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500/50"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500/50"></div>
                  </div>
                  <pre className="text-slate-300">
                    <code>
                      <span className="text-orange-300">&lt;script</span> <span className="text-amber-300">defer</span> <span className="text-amber-300">data-domain</span>=<span className="text-yellow-200">"yoursite.com"</span> <span className="text-amber-300">src</span>=<span className="text-yellow-200">"https://lytx.app/script.js"</span><span className="text-orange-300">&gt;&lt;/script&gt;</span>
                    </code>
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="py-24 bg-slate-50 dark:bg-slate-900/30 scroll-mt-20">
          <div className="max-w-[64rem] mx-auto px-4 sm:px-6 lg:px-8">
            <SectionHeading title="Frequently Asked Questions" />

            <div className="space-y-6">
              {[
                { q: "Is Lytx GDPR compliant?", a: "Yes, fully. We don't use cookies and we don't collect any personal data. You don't even need a cookie banner." },
                { q: "Can I self-host Lytx?", a: "Absolutely. Lytx is open-source. You can self-host on Cloudflare with our Alchemy deploy script." },
                { q: "Will it slow down my site?", a: "No. Our script is under 5kb and loads asynchronously, so it doesn't block your page rendering." },
                { q: "How is this different from Google Analytics?", a: "GA is complex, invasive, and sells your data. Lytx is simple, private, and yours." }
              ].map((item, i) => (
                <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
                  <h3 className="font-bold text-slate-900 dark:text-white mb-2">{item.q}</h3>
                  <p className="text-slate-600 dark:text-slate-400">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-24 text-center">
          <div className="max-w-[48rem] mx-auto px-4">
            <h2 className="text-4xl font-bold text-slate-900 dark:text-white mb-6">Ready to take control of your data?</h2>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <a
                href="/signup"
                className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold rounded-full text-white bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-black dark:hover:bg-slate-200 transition-all shadow-lg"
              >
                Sign Up
              </a>
              <a
                href="/get-started"
                className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold rounded-full text-slate-900 border border-slate-200 hover:bg-slate-50 dark:text-white dark:border-slate-700 dark:hover:bg-slate-800 transition-all"
              >
                Self-Host on Cloudflare
              </a>
            </div>

          </div>
        </section>

    </MarketingLayout>
  );
}
