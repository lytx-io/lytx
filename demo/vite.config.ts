import path from "node:path";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { defineConfig, type Plugin } from "vite";
import tailwindcss from "@tailwindcss/vite";
import alchemy from "alchemy/cloudflare/redwood";

const require = createRequire(import.meta.url);
const VIRTUAL_MODULE_ID = "virtual:lytx-pixel-raw";
const RESOLVED_VIRTUAL_ID = `\0${VIRTUAL_MODULE_ID}`;
const coreRoot = path.dirname(require.resolve("lytx/package.json"));

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

  const bundled = result.outputFiles[0];
  if (!bundled) {
    throw new Error(`Failed to bundle template script: ${entryFile}`);
  }

  return bundled.text
    .replace(/export\s*\{([^}]+)\};?/g, (_match, exports) => {
      return exports
        .split(",")
        .map((exp: string) => {
          const parts = exp.trim().split(/\s+as\s+/);
          if (parts.length === 2) {
            const source = parts[0]?.trim();
            const target = parts[1]?.trim();
            if (!source || !target) {
              return "";
            }
            return `var ${target}=${source};`;
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
  publicDir: path.resolve(coreRoot, "public"),
  resolve: {
    alias: {
      "@/Document": path.resolve(__dirname, "./src/Document.tsx"),
      "@": path.resolve(coreRoot, "src"),
      "@cli": path.resolve(coreRoot, "cli"),
      "@app": path.resolve(coreRoot, "src/app"),
      "@utilities": path.resolve(coreRoot, "src/utilities"),
      "@components": path.resolve(coreRoot, "src/app/components"),
      "@pages": path.resolve(coreRoot, "src/pages"),
      "@api": path.resolve(coreRoot, "src/api"),
      "@lib": path.resolve(coreRoot, "lib"),
      "@db": path.resolve(coreRoot, "db"),
      "@generated": path.resolve(coreRoot, "generated"),
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
