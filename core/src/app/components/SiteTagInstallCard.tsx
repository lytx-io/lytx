"use client";

import { useMemo, useState } from "react";
import { Highlight, themes } from "prism-react-renderer";
import { Button } from "@/app/components/ui/Button";
import { LYTX_SCRIPT_PATH } from "@/app/constants";

type SiteTagInstallCardProps = {
  site: {
    site_id?: number;
    name?: string | null;
    domain?: string | null;
    tag_id: string;
    createdAt?: string | Date | null;
  };
  className?: string;
};

function CodeBlock({
  code,
  language,
  id,
}: {
  code: string;
  language: string;
  id: string;
}) {
  return (
    <div
      id={id}
      className="bg-[var(--theme-input-bg)] border border-[var(--theme-input-border)] rounded-md overflow-hidden"
    >
      <Highlight theme={themes.vsDark} code={code} language={language}>
        {({ className: highlightClassName, style, tokens, getLineProps, getTokenProps }) => (
          <pre
            className={`${highlightClassName} p-4 text-sm overflow-x-auto`}
            style={style}
          >
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })}>
                {line.map((token, key) => (
                  <span key={key} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    </div>
  );
}

export function SiteTagInstallCard({ site, className }: SiteTagInstallCardProps) {
  const [activeInstallTab, setActiveInstallTab] = useState("html");
  const lytxDomain = useMemo(
    () => (typeof window !== "undefined" ? window.location.origin : "https://lytx.io"),
    [],
  );
  const containerClassName = className
    ? `border border-[var(--theme-border-primary)] rounded-lg p-6 bg-[var(--theme-bg-secondary)] ${className}`
    : "border border-[var(--theme-border-primary)] rounded-lg p-6 bg-[var(--theme-bg-secondary)]";

  const getCodeForTab = (tab: string) => {
    switch (tab) {
      case "html":
        return `<script defer \n src=\"${lytxDomain}${LYTX_SCRIPT_PATH}?account=${site.tag_id}\"\n></script>`;
      case "rwsdk":
        return `// In your Document.tsx\nexport const Document = ({ children }) => (\n  <html>\n    <head>{/* ... */}</head>\n    <body>\n      <div id=\"root\">{children}</div>\n      <script>import(\"/src/client.tsx\")</script>\n      <script\n        defer\n        src=\"${lytxDomain}${LYTX_SCRIPT_PATH}?account=${site.tag_id}\"\n      ></script>\n    </body>\n  </html>\n);`;
      case "sveltekit":
        return `<!-- In your src/app.html -->\n<script\n  defer\n  src=\"${lytxDomain}${LYTX_SCRIPT_PATH}?account=${site.tag_id}\"\n></script>\n\n<!-- Or in your +layout.svelte -->\n<svelte:head>\n  <script\n    defer\n    src=\"${lytxDomain}${LYTX_SCRIPT_PATH}?account=${site.tag_id}\"\n  ></script>\n</svelte:head>`;
      case "solid":
        return `// In your root.tsx or index.html\nimport { Script } from \"@solidjs/meta\";\n\nexport default function Root() {\n  return (\n    <Html>\n      <Head>\n        <Script\n          defer\n          src=\"${lytxDomain}${LYTX_SCRIPT_PATH}?account=${site.tag_id}\"\n        />\n      </Head>\n      <Body>\n        {/* Your app content */}\n      </Body>\n    </Html>\n  );\n}`;
      case "nextjs":
        return `// In your _document.tsx or layout.tsx (App Router)\nimport Script from 'next/script';\n\nexport default function RootLayout({ children }) {\n  return (\n    <html>\n      <head>\n        <Script\n          defer\n          src=\"${lytxDomain}${LYTX_SCRIPT_PATH}?account=${site.tag_id}\"\n          strategy=\"beforeInteractive\"\n        />\n      </head>\n      <body>{children}</body>\n    </html>\n  );\n}`;
      case "nuxt":
        return `// In your nuxt.config.ts\nexport default defineNuxtConfig({\n  app: {\n    head: {\n      script: [\n        {\n          src: '${lytxDomain}${LYTX_SCRIPT_PATH}?account=${site.tag_id}',\n          defer: true\n        }\n      ]\n    }\n  }\n});\n\n// Or use useHead() in a component/page\nuseHead({\n  script: [\n    {\n      src: '${lytxDomain}${LYTX_SCRIPT_PATH}?account=${site.tag_id}',\n      defer: true\n    }\n  ]\n});`;
      default:
        return "";
    }
  };

  return (
    <div className={containerClassName}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-2">
            <h3 className="text-lg font-medium text-[var(--theme-text-primary)]">
              {site.name || "Selected Site"}
            </h3>
            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
              active
            </span>
          </div>
          <div className="text-sm text-[var(--theme-text-secondary)] space-y-1">
            <p>
              <span className="font-medium">Domain:</span>{" "}
              {site.domain || "—"}
            </p>
            <p>
              <span className="font-medium">Tag ID:</span>{" "}
              <code className="bg-[var(--theme-input-bg)] px-2 py-1 rounded text-xs">
                {site.tag_id}
              </code>
            </p>
            <p>
              <span className="font-medium">Created:</span>{" "}
              {site.createdAt ? new Date(site.createdAt).toLocaleDateString() : "N/A"}
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-[var(--theme-border-primary)] pt-4">
        <div className="flex items-center justify-between mb-4">
          <label className="text-sm font-medium text-[var(--theme-text-primary)]">
            Installation Instructions
          </label>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              const code = getCodeForTab(activeInstallTab);
              if (code) {
                navigator.clipboard.writeText(code);
                alert("Code copied to clipboard!");
              }
            }}
          >
            Copy Code
          </Button>
        </div>

        <div className="flex space-x-1 mb-4 bg-[var(--theme-bg-secondary)] p-1 rounded-lg">
          {[
            { id: "html", label: "HTML" },
            { id: "rwsdk", label: "RWSDK" },
            { id: "sveltekit", label: "SvelteKit" },
            { id: "solid", label: "Solid" },
            { id: "nextjs", label: "Next.js" },
            { id: "nuxt", label: "Nuxt" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveInstallTab(tab.id)}
              className={`px-3 py-2 text-xs font-medium rounded-md transition-colors ${activeInstallTab === tab.id
                ? "bg-[var(--theme-bg-primary)] text-[var(--theme-text-primary)] shadow-sm"
                : "text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)]"
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {activeInstallTab === "html" && (
            <div>
              <CodeBlock
                id="install-content-html"
                language="html"
                code={`<script\n  defer\n  src=\"${lytxDomain}${LYTX_SCRIPT_PATH}?account=${site.tag_id}\"\n></script>`}
              />
              <p className="text-xs text-[var(--theme-text-secondary)] mt-2">
                Copy and paste this script into the &lt;head&gt; section of your HTML.
              </p>
            </div>
          )}

          {activeInstallTab === "rwsdk" && (
            <div>
              <CodeBlock
                id="install-content-rwsdk"
                language="tsx"
                code={`// In your Document.tsx\nexport const Document = ({ children }) => (\n  <html>\n    <head>{/* ... */}</head>\n    <body>\n      <div id=\"root\">{children}</div>\n      <script>import(\"/src/client.tsx\")</script>\n      <script\n        defer\n        src=\"${lytxDomain}${LYTX_SCRIPT_PATH}?account=${site.tag_id}\"\n      ></script>\n    </body>\n  </html>\n);`}
              />
              <p className="text-xs text-[var(--theme-text-secondary)] mt-2">
                Add this to your Document.tsx or root layout component.
              </p>
            </div>
          )}

          {activeInstallTab === "sveltekit" && (
            <div>
              <CodeBlock
                id="install-content-sveltekit"
                language="html"
                code={`<!-- In your src/app.html -->\n<script\n  defer\n  src=\"${lytxDomain}${LYTX_SCRIPT_PATH}?account=${site.tag_id}\"\n></script>\n\n<!-- Or in your +layout.svelte -->\n<svelte:head>\n  <script\n    defer\n    src=\"${lytxDomain}${LYTX_SCRIPT_PATH}?account=${site.tag_id}\"\n  ></script>\n</svelte:head>`}
              />
              <p className="text-xs text-[var(--theme-text-secondary)] mt-2">
                Add the script to your SvelteKit app.html or layout.
              </p>
            </div>
          )}

          {activeInstallTab === "solid" && (
            <div>
              <CodeBlock
                id="install-content-solid"
                language="tsx"
                code={`// In your root.tsx or index.html\nimport { Script } from \"@solidjs/meta\";\n\nexport default function Root() {\n  return (\n    <Html>\n      <Head>\n        <Script\n          defer\n          src=\"${lytxDomain}${LYTX_SCRIPT_PATH}?account=${site.tag_id}\"\n        />\n      </Head>\n      <Body>\n        {/* Your app content */}\n      </Body>\n    </Html>\n  );\n}`}
              />
              <p className="text-xs text-[var(--theme-text-secondary)] mt-2">
                Place the script tag in your Solid root layout.
              </p>
            </div>
          )}

          {activeInstallTab === "nextjs" && (
            <div>
              <CodeBlock
                id="install-content-nextjs"
                language="tsx"
                code={`// In your _document.tsx or layout.tsx (App Router)\nimport Script from 'next/script';\n\nexport default function RootLayout({ children }) {\n  return (\n    <html>\n      <head>\n        <Script\n          defer\n          src=\"${lytxDomain}${LYTX_SCRIPT_PATH}?account=${site.tag_id}\"\n          strategy=\"beforeInteractive\"\n        />\n      </head>\n      <body>{children}</body>\n    </html>\n  );\n}`}
              />
              <p className="text-xs text-[var(--theme-text-secondary)] mt-2">
                Add the script to your Next.js document or root layout.
              </p>
            </div>
          )}

          {activeInstallTab === "nuxt" && (
            <div>
              <CodeBlock
                id="install-content-nuxt"
                language="ts"
                code={`// In your nuxt.config.ts\nexport default defineNuxtConfig({\n  app: {\n    head: {\n      script: [\n        {\n          src: '${lytxDomain}${LYTX_SCRIPT_PATH}?account=${site.tag_id}',\n          defer: true\n        }\n      ]\n    }\n  }\n});\n\n// Or use useHead() in a component/page\nuseHead({\n  script: [\n    {\n      src: '${lytxDomain}${LYTX_SCRIPT_PATH}?account=${site.tag_id}',\n      defer: true\n    }\n  ]\n});`}
              />
              <p className="text-xs text-[var(--theme-text-secondary)] mt-2">
                Configure the script in nuxt.config.ts or useHead.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
