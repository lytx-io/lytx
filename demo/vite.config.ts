import path from "node:path";
import { build } from "esbuild";
import { defineConfig, type Plugin } from "vite";
import tailwindcss from "@tailwindcss/vite";
import alchemy from "alchemy/cloudflare/redwood";

const VIRTUAL_MODULE_ID = "virtual:lytx-pixel-raw";
const RESOLVED_VIRTUAL_ID = `\0${VIRTUAL_MODULE_ID}`;
const coreRoot = path.resolve(__dirname, "../core");

function lytxPixelBundlePlugin(): Plugin {
  let cachedFull: string | null = null;
  let cachedCore: string | null = null;

  return {
    name: "demo-lytx-pixel-bundle",
    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) {
        return RESOLVED_VIRTUAL_ID;
      }
    },
    async load(id) {
      if (id !== RESOLVED_VIRTUAL_ID) return;

      const [fullBundle, coreBundle] = await Promise.all([
        cachedFull ?? bundlePixelScript("lytxpixel.ts"),
        cachedCore ?? bundlePixelScript("lytxpixel-core.ts"),
      ]);

      cachedFull = fullBundle;
      cachedCore = coreBundle;

      return `
export const script_tag_manager = ${JSON.stringify(fullBundle)};
export const script_core = ${JSON.stringify(coreBundle)};
`;
    },
    handleHotUpdate({ file }) {
      if (
        file.includes("templates/lytxpixel") ||
        file.includes("templates/vendors") ||
        file.includes("templates/trackWebEvents")
      ) {
        cachedFull = null;
        cachedCore = null;
      }
    },
  };
}

async function bundlePixelScript(entryFile: "lytxpixel.ts" | "lytxpixel-core.ts"): Promise<string> {
  const entryPoint = path.resolve(coreRoot, `src/templates/${entryFile}`);

  const result = await build({
    entryPoints: [entryPoint],
    bundle: true,
    write: false,
    target: "es2017",
    format: "esm",
    treeShaking: true,
    charset: "utf8",
    minify: true,
  });

  return result.outputFiles[0].text
    .replace(/export\s*\{([^}]+)\};?/g, (_match, exports) => {
      return exports
        .split(",")
        .map((exp: string) => {
          const parts = exp.trim().split(/\s+as\s+/);
          if (parts.length === 2) {
            return `var ${parts[1].trim()}=${parts[0].trim()};`;
          }
          return "";
        })
        .join("");
    })
    .replace(/export\s+default\s+[^;]+;?/g, "")
    .trim();
}

export default defineConfig({
  plugins: [lytxPixelBundlePlugin(), alchemy(), tailwindcss()],
  publicDir: path.resolve(__dirname, "../core/public"),
  resolve: {
    alias: {
      "@/Document": path.resolve(__dirname, "./src/Document.tsx"),
      "@": path.resolve(__dirname, "../core/src"),
      "@cli": path.resolve(__dirname, "../core/cli"),
      "@app": path.resolve(__dirname, "../core/src/app"),
      "@utilities": path.resolve(__dirname, "../core/src/utilities"),
      "@components": path.resolve(__dirname, "../core/src/app/components"),
      "@pages": path.resolve(__dirname, "../core/src/pages"),
      "@api": path.resolve(__dirname, "../core/src/api"),
      "@lib": path.resolve(__dirname, "../core/lib"),
      "@db": path.resolve(__dirname, "../core/db"),
      "@generated": path.resolve(__dirname, "../core/generated"),
    },
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    port: 5173,
    fs: {
      allow: [path.resolve(__dirname, "..")],
    },
  },
});
