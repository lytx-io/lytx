// @ts-ignore
import styles from "./index.css?url";

const themeBootstrapScript = `(() => {
  const root = document.documentElement;
  let savedTheme = null;

  try {
    savedTheme = localStorage.getItem("theme");
  } catch {}

  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme =
    savedTheme === "light" || savedTheme === "dark"
      ? savedTheme
      : prefersDark
        ? "dark"
        : "light";

  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme;
})();`;

export const Document: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <html lang="en">
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta
        name="description"
        content="Simple, privacy-friendly web analytics. Track what matters without compromising your visitors' privacy."
      />
      <meta name="application-name" content="Lytx" />

      <meta property="og:type" content="website" />
      <meta property="og:title" content="Lytx — Privacy-Friendly Web Analytics" />
      <meta
        property="og:description"
        content="Simple, privacy-friendly web analytics. Track what matters without compromising your visitors' privacy."
      />
      <meta property="og:image" content="/images/lytx_dark_dashboard.png" />
      <meta property="og:site_name" content="Lytx" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="Lytx — Privacy-Friendly Web Analytics" />
      <meta
        name="twitter:description"
        content="Simple, privacy-friendly web analytics. Track what matters without compromising your visitors' privacy."
      />
      <meta name="twitter:image" content="/images/lytx_dark_dashboard.png" />
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      <meta name="apple-mobile-web-app-title" content="Lytx" />
      <meta name="format-detection" content="telephone=no" />
      <meta name="color-scheme" content="light dark" />
      <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      <link rel="stylesheet" href={styles} />
      <link rel="apple-touch-icon" sizes="180x180" href="/images/apple-touch-icon.png" />
      <link rel="icon" type="image/png" sizes="32x32" href="/images/favicon-32x32.png" />
      <link rel="icon" type="image/png" sizes="16x16" href="/images/favicon-16x16.png" />
      <link rel="icon" href="/favicon.ico" />
      <link rel="manifest" href="/site.webmanifest" />
      <link rel="mask-icon" href="/images/safari-pinned-tab.svg" color="#5bbad5" />
      <meta name="msapplication-TileColor" content="#da532c" />
      <meta name="theme-color" content="#ffffff" />
      <meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff" />
      <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#121212" />

      <title>Lytx</title>
      <link rel="modulepreload" href="/src/client.tsx" />
    </head>
    <body className="overflow-x-hidden">
      <div id="root">{children}</div>
      <script>import("/src/client.tsx")</script>
    </body>
  </html>
);
