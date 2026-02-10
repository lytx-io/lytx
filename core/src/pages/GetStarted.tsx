import { MarketingLayout } from "@/app/components/marketing/MarketingLayout";

export function GetStarted() {
  return (
    <MarketingLayout>

      <section className="pt-32 pb-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold uppercase tracking-wider mb-6 border border-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800">
            Self-hosted on Cloudflare
          </span>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-slate-900 dark:text-white mb-6 leading-[1.1]">
            Get started with Lytx in your Cloudflare account
          </h1>
          <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-[46rem] mx-auto leading-relaxed">
            Deploy the open-source stack with Alchemy and own the data end to end. This is the free, self-hosted option.
          </p>
        </div>
      </section>

      <section className="pb-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div className="space-y-6">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
              Use the Alchemy deploy script
            </h2>
            <p className="text-base md:text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
              Replace the placeholders with your Cloudflare resources and domain, then run your Alchemy deploy. This example mirrors `alchemy.run.ts` with safe placeholder names.
            </p>
            <div className="space-y-4 text-slate-600 dark:text-slate-400">
              <div className="flex items-start gap-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 text-sm font-semibold">1</span>
                <p className="flex-1">Set your app name and Cloudflare domain.</p>
              </div>
              <div className="flex items-start gap-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 text-sm font-semibold">2</span>
                <p className="flex-1">Create your D1, KV, and Queue names.</p>
              </div>
              <div className="flex items-start gap-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 text-sm font-semibold">3</span>
                <p className="flex-1">Set the required secrets in your environment before deploy.</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl bg-slate-900 p-6 border border-slate-800 shadow-2xl">
            <div className="text-xs text-slate-400 mb-4 font-mono">alchemy.run.ts</div>
            <pre className="text-slate-200 text-xs md:text-sm leading-relaxed overflow-x-auto font-mono">
              <code className="block whitespace-pre">
                <span className="text-cyan-300">import</span>{" "}
                <span className="text-slate-200">type</span>{" "}
                <span className="text-slate-200">&#123;</span>{" "}
                <span className="text-amber-300">SiteDurableObject</span>{" "}
                <span className="text-slate-200">&#125;</span>{" "}
                <span className="text-cyan-300">from</span>{" "}
                <span className="text-emerald-300">"./db/durable/siteDurableObject"</span>
                <span className="text-slate-200">;</span>
                <br />
                <span className="text-cyan-300">import</span>{" "}
                <span className="text-sky-200">alchemy</span>{" "}
                <span className="text-cyan-300">from</span>{" "}
                <span className="text-emerald-300">"alchemy"</span>
                <span className="text-slate-200">;</span>
                <br />
                <span className="text-cyan-300">import</span>{" "}
                <span className="text-slate-200">&#123;</span>{" "}
                <span className="text-sky-200">D1Database</span>
                <span className="text-slate-200">,</span>{" "}
                <span className="text-sky-200">KVNamespace</span>
                <span className="text-slate-200">,</span>{" "}
                <span className="text-sky-200">DurableObjectNamespace</span>
                <span className="text-slate-200">,</span>{" "}
                <span className="text-sky-200">Redwood</span>
                <span className="text-slate-200">,</span>{" "}
                <span className="text-sky-200">Queue</span>{" "}
                <span className="text-slate-200">&#125;</span>{" "}
                <span className="text-cyan-300">from</span>{" "}
                <span className="text-emerald-300">"alchemy/cloudflare"</span>
                <span className="text-slate-200">;</span>
                <br />
                <br />
                <span className="text-cyan-300">const</span>{" "}
                <span className="text-slate-200">app = </span>
                <span className="text-cyan-300">await</span>{" "}
                <span className="text-sky-200">alchemy</span>
                <span className="text-slate-200">(</span>
                <span className="text-emerald-300">"your-app-name"</span>
                <span className="text-slate-200">);</span>
                <br />
                <span className="text-cyan-300">const</span>{" "}
                <span className="text-slate-200">adoptMode = </span>
                <span className="text-purple-300">true</span>
                <span className="text-slate-200">;</span>
                <br />
                <br />
                <span className="text-cyan-300">const</span>{" "}
                <span className="text-slate-200">siteDurableObject = </span>
                <span className="text-sky-200">DurableObjectNamespace</span>
                <span className="text-slate-200">&lt;</span>
                <span className="text-amber-300">SiteDurableObject</span>
                <span className="text-slate-200">&gt;(</span>
                <span className="text-emerald-300">"site-durable-object"</span>
                <span className="text-slate-200">, </span>
                <span className="text-slate-200">&#123;</span>
                <br />
                <span className="text-slate-200">{"  "}className: </span>
                <span className="text-emerald-300">"SiteDurableObject"</span>
                <span className="text-slate-200">,</span>
                <br />
                <span className="text-slate-200">{"  "}sqlite: </span>
                <span className="text-purple-300">true</span>
                <span className="text-slate-200">,</span>
                <br />
                <span className="text-slate-200">&#125;);</span>
                <br />
                <br />
                <span className="text-cyan-300">const</span>{" "}
                <span className="text-slate-200">lytxEvents = </span>
                <span className="text-cyan-300">await</span>{" "}
                <span className="text-sky-200">KVNamespace</span>
                <span className="text-slate-200">(</span>
                <span className="text-emerald-300">"lytx-events"</span>
                <span className="text-slate-200">, &#123; adopt: adoptMode, delete: </span>
                <span className="text-purple-300">false</span>
                <span className="text-slate-200"> &#125;);</span>
                <br />
                <span className="text-cyan-300">const</span>{" "}
                <span className="text-slate-200">lytxConfig = </span>
                <span className="text-cyan-300">await</span>{" "}
                <span className="text-sky-200">KVNamespace</span>
                <span className="text-slate-200">(</span>
                <span className="text-emerald-300">"lytx-config"</span>
                <span className="text-slate-200">, &#123; adopt: adoptMode, delete: </span>
                <span className="text-purple-300">false</span>
                <span className="text-slate-200"> &#125;);</span>
                <br />
                <span className="text-cyan-300">const</span>{" "}
                <span className="text-slate-200">lytxSessions = </span>
                <span className="text-cyan-300">await</span>{" "}
                <span className="text-sky-200">KVNamespace</span>
                <span className="text-slate-200">(</span>
                <span className="text-emerald-300">"lytx-sessions"</span>
                <span className="text-slate-200">, &#123; adopt: adoptMode, delete: </span>
                <span className="text-purple-300">false</span>
                <span className="text-slate-200"> &#125;);</span>
                <br />
                <span className="text-cyan-300">const</span>{" "}
                <span className="text-slate-200">siteEventsQueue = </span>
                <span className="text-cyan-300">await</span>{" "}
                <span className="text-sky-200">Queue</span>
                <span className="text-slate-200">(</span>
                <span className="text-emerald-300">"site-events-queue"</span>
                <span className="text-slate-200">, &#123; adopt: adoptMode, delete: </span>
                <span className="text-purple-300">false</span>
                <span className="text-slate-200"> &#125;);</span>
                <br />
                <br />
                <span className="text-cyan-300">const</span>{" "}
                <span className="text-slate-200">lytxCoreDb = </span>
                <span className="text-cyan-300">await</span>{" "}
                <span className="text-sky-200">D1Database</span>
                <span className="text-slate-200">(</span>
                <span className="text-emerald-300">"lytx-core-db"</span>
                <span className="text-slate-200">, &#123;</span>
                <br />
                <span className="text-slate-200">{"  "}name: </span>
                <span className="text-emerald-300">"lytx-core-db"</span>
                <span className="text-slate-200">,</span>
                <br />
                <span className="text-slate-200">{"  "}migrationsDir: </span>
                <span className="text-emerald-300">"./db/d1/migrations"</span>
                <span className="text-slate-200">,</span>
                <br />
                <span className="text-slate-200">{"  "}adopt: adoptMode,</span>
                <br />
                <span className="text-slate-200">{"  "}delete: </span>
                <span className="text-purple-300">false</span>
                <span className="text-slate-200">,</span>
                <br />
                <span className="text-slate-200">&#125;);</span>
                <br />
                <br />
                <span className="text-cyan-300">export</span>{" "}
                <span className="text-cyan-300">const</span>{" "}
                <span className="text-slate-200">worker = </span>
                <span className="text-cyan-300">await</span>{" "}
                <span className="text-sky-200">Redwood</span>
                <span className="text-slate-200">(</span>
                <span className="text-emerald-300">"lytx"</span>
                <span className="text-slate-200">, &#123;</span>
                <br />
                <span className="text-slate-200">{"  "}adopt: </span>
                <span className="text-purple-300">true</span>
                <span className="text-slate-200">,</span>
                <br />
                <span className="text-slate-200">{"  "}domains: [&#123; adopt: </span>
                <span className="text-purple-300">true</span>
                <span className="text-slate-200">, domainName: </span>
                <span className="text-emerald-300">"analytics.your-domain.com"</span>
                <span className="text-slate-200"> &#125;],</span>
                <br />
                <span className="text-slate-200">{"  "}wrangler: &#123;</span>
                <br />
                <span className="text-slate-200">{"    "}main: </span>
                <span className="text-emerald-300">"src/worker.tsx"</span>
                <span className="text-slate-200">,</span>
                <br />
                <span className="text-slate-200">{"    "}transform: (spec) =&gt; (&#123;</span>
                <br />
                <span className="text-slate-200">{"      "}...spec,</span>
                <br />
                <span className="text-slate-200">{"      "}compatibility_flags: [</span>
                <span className="text-emerald-300">"nodejs_compat"</span>
                <span className="text-slate-200">],</span>
                <br />
                <span className="text-slate-200">{"    "}&#125;),</span>
                <br />
                <span className="text-slate-200">{"  "}&#125;,</span>
                <br />
                <span className="text-slate-200">{"  "}bindings: &#123;</span>
                <br />
                <span className="text-slate-200">{"    "}SITE_DURABLE_OBJECT: siteDurableObject,</span>
                <br />
                <span className="text-slate-200">{"    "}LYTX_EVENTS: lytxEvents,</span>
                <br />
                <span className="text-slate-200">{"    "}lytx_config: lytxConfig,</span>
                <br />
                <span className="text-slate-200">{"    "}lytx_sessions: lytxSessions,</span>
                <br />
                <span className="text-slate-200">{"    "}lytx_core_db: lytxCoreDb,</span>
                <br />
                <span className="text-slate-200">{"    "}SITE_EVENTS_QUEUE: siteEventsQueue,</span>
                <br />
                <span className="text-slate-200">{"    "}LYTX_DOMAIN: process.env.LYTX_DOMAIN,</span>
                <br />
                <span className="text-slate-200">{"    "}BETTER_AUTH_SECRET: alchemy.secret(process.env.BETTER_AUTH_SECRET),</span>
                <br />
                <span className="text-slate-200">{"    "}GITHUB_CLIENT_SECRET: alchemy.secret(process.env.GITHUB_CLIENT_SECRET),</span>
                <br />
                <span className="text-slate-200">{"    "}GOOGLE_CLIENT_SECRET: alchemy.secret(process.env.GOOGLE_CLIENT_SECRET),</span>
                <br />
                <span className="text-slate-200">{"    "}RESEND_API_KEY: alchemy.secret(process.env.RESEND_API_KEY),</span>
                <br />
                <span className="text-slate-200">{"    "}ENCRYPTION_KEY: alchemy.secret(process.env.ENCRYPTION_KEY),</span>
                <br />
                <span className="text-slate-200">{"  "}&#125;,</span>
                <br />
                <span className="text-slate-200">&#125;);</span>
              </code>
            </pre>
            <div className="mt-4 text-xs text-slate-400">
              Source code:{" "}
              <a
                href="https://github.com/lytx-io/lytx"
                className="text-amber-300 hover:text-amber-200"
                target="_blank"
                rel="noreferrer"
              >
                github.com/lytx-io/lytx
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">Need help with deployment?</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-8">
            We can walk you through setup and verify your Cloudflare resources before launch.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <a
              href="https://github.com/lytx-io/lytx"
              className="inline-flex items-center justify-center px-6 py-3 rounded-full border border-slate-200 text-slate-900 font-semibold hover:bg-slate-50 dark:border-slate-700 dark:text-white dark:hover:bg-slate-800 transition-colors"
            >
              View the repo
            </a>
            <a
              href="/pricing"
              className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-orange-600 text-white font-semibold hover:bg-orange-500 transition-colors shadow-lg shadow-orange-500/20"
            >
              Compare plans
            </a>
          </div>
        </div>
      </section>

    </MarketingLayout>
  );
}
